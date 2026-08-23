from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.core.config import get_settings
from app.db.models import avatar_pair
from app.schemas.common import NonBlank


class UserBrief(BaseModel):
    """A person as they appear in a list, header, or member roster."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    phone: str
    username: str | None = None
    avatar_url: str | None
    avatar_token: str
    about: str | None
    last_seen_at: datetime | None

    @computed_field
    @property
    def avatar_color(self) -> str:
        """The pale fill."""
        return avatar_pair(self.avatar_token)[0]

    @computed_field
    @property
    def avatar_fg(self) -> str:
        """The initials, in a strong version of the same hue."""
        return avatar_pair(self.avatar_token)[1]

    @computed_field
    @property
    def online(self) -> bool:
        """Mocked presence, derived from last_seen_at."""
        if self.last_seen_at is None:
            return False
        # SQLite hands back naive datetimes even for timezone=True columns.
        seen = self.last_seen_at
        if seen.tzinfo is None:
            seen = seen.replace(tzinfo=timezone.utc)
        window = timedelta(seconds=get_settings().presence_window_seconds)
        return datetime.now(timezone.utc) - seen < window


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    mime: str
    size: int
    data_url: str
    width: int | None = None
    height: int | None = None

    @computed_field
    @property
    def is_image(self) -> bool:
        return self.mime.startswith("image/")


class ReactionOut(BaseModel):
    """One emoji, who used it, and whether that includes the caller.

    Grouped server-side: the client renders pills, and counting them per emoji
    in one place keeps every client consistent.
    """

    emoji: str
    count: int
    # Display names, for the "Alice, Bob reacted 👍" tooltip.
    names: list[str]
    mine: bool


class QuotedMessage(BaseModel):
    """The snippet a reply shows above itself.

    Deliberately not a full MessageOut: a quote is a flat preview, and nesting
    the real thing would recurse through a reply chain.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: int | None
    body: str
    deleted_at: datetime | None = None
    sender_name: str | None = None
    # So a quote of an image can show a thumbnail rather than empty text.
    attachment_count: int = 0


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int | None
    type: str
    body: str
    reply_to_id: int | None = None
    created_at: datetime
    edited_at: datetime | None = None
    deleted_at: datetime | None = None
    expires_at: datetime | None = None
    sender: UserBrief | None = None
    attachments: list[AttachmentOut] = Field(default_factory=list)
    # Grouped by the service layer into `reaction_pills`, a plain attribute.
    # Reading the `reactions` relationship directly would mean overwriting a
    # mapped collection with dicts, which SQLAlchemy tries to flush.
    reactions: list[ReactionOut] = Field(
        default_factory=list, validation_alias="reaction_pills"
    )
    quote: QuotedMessage | None = None
    # Tick state, present only on messages the caller sent.
    status: str | None = None
    # Echoed back from the send request so the sender can match this to the
    # bubble it already drew optimistically.
    client_id: str | None = None


class ConversationOut(BaseModel):
    """One sidebar row. The display title is derived client-side from `type`,
    `name` and `members`, so presentation rules stay in one place."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    type: str
    name: str | None
    avatar_url: str | None
    avatar_token: str | None
    created_by: int | None

    @computed_field
    @property
    def avatar_color(self) -> str:
        return avatar_pair(self.avatar_token)[0]

    @computed_field
    @property
    def avatar_fg(self) -> str:
        return avatar_pair(self.avatar_token)[1]

    created_at: datetime
    last_message_at: datetime
    # Read from the model's flattened property, but serialised as "members".
    members: list[UserBrief] = Field(default_factory=list, validation_alias="member_users")
    last_message: MessageOut | None = None
    unread_count: int = 0
    # Disappearing-message timer in seconds; 0 is off.
    disappear_seconds: int = 0


class MemberOut(BaseModel):
    """A membership row: who, and what they may do."""

    model_config = ConfigDict(from_attributes=True)

    role: str
    joined_at: datetime
    last_read_message_id: int
    user: UserBrief


class ConversationCreate(BaseModel):
    # Exactly one shape: a direct chat with `user_id`, or a group with
    # `name` + `member_ids`.
    user_id: int | None = None
    name: str | None = None
    member_ids: list[int] | None = None


class ConversationUpdate(BaseModel):
    name: NonBlank


class AddMembersRequest(BaseModel):
    user_ids: list[int]


class MarkReadRequest(BaseModel):
    message_id: int


class AttachmentIn(BaseModel):
    """One uploaded file, inline as a data URI."""

    name: NonBlank
    mime: NonBlank
    data_url: NonBlank
    width: int | None = None
    height: int | None = None


class MessageCreate(BaseModel):
    # Blank is allowed when attachments carry the message: an image with no
    # caption is a real message, an empty text one is not.
    body: str = ""
    reply_to_id: int | None = None
    attachments: list[AttachmentIn] = Field(default_factory=list)
    # Opaque id generated by the client; echoed back, never stored.
    client_id: str | None = None


class ReactionRequest(BaseModel):
    """Empty emoji removes the caller's reaction, so one call covers both."""

    emoji: str = ""


class DisappearingRequest(BaseModel):
    """Seconds to live, or 0 for off. Validated against DISAPPEAR_CHOICES."""

    seconds: int
