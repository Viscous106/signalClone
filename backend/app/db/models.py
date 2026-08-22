"""SQLAlchemy models. Schema rationale lives in docs/SCHEMA.md."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Signal assigns each contact a deterministic colour, used behind initials when
# there is no avatar image. See docs/SIGNAL-UI-REFERENCE.md.
AVATAR_COLORS = (
    "#336BA3", "#6F6A58", "#CF163E", "#3B7845", "#6058CA", "#AA377A",
    "#71717F", "#8F616A", "#077D92", "#C73F0A", "#9932C8", "#1D8663",
)


def pick_avatar_color(seed: str) -> str:
    """Stable colour for a given identity — same user always gets the same one."""
    return AVATAR_COLORS[sum(seed.encode()) % len(AVATAR_COLORS)]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(64), unique=True)
    display_name: Mapped[str] = mapped_column(String(128))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512))
    avatar_color: Mapped[str] = mapped_column(
        String(7),
        default=lambda ctx: pick_avatar_color(
            str(ctx.get_current_parameters().get("phone") or "")
        ),
    )
    about: Mapped[Optional[str]] = mapped_column(String(256))
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="owner",
        foreign_keys="Contact.owner_id",
        cascade="all, delete-orphan",
    )
    memberships: Mapped[list["ConversationMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User {self.id} {self.display_name!r}>"


class Contact(Base):
    """A user's address book. Directional: Alice having Bob is not mutual."""

    __tablename__ = "contacts"
    __table_args__ = (
        UniqueConstraint("owner_id", "contact_user_id", name="uq_contact_pair"),
        CheckConstraint("owner_id != contact_user_id", name="ck_contact_not_self"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    contact_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    nickname: Mapped[Optional[str]] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner: Mapped["User"] = relationship(back_populates="contacts", foreign_keys=[owner_id])
    contact_user: Mapped["User"] = relationship(foreign_keys=[contact_user_id])


class Conversation(Base):
    """Direct chats and groups in one table, discriminated by `type`."""

    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint("type IN ('direct', 'group')", name="ck_conversation_type"),
        Index("ix_conv_last_message", "last_message_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(16))
    name: Mapped[Optional[str]] = mapped_column(String(128))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512))
    avatar_color: Mapped[Optional[str]] = mapped_column(String(7))
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # Denormalised so the sidebar can sort without touching `messages`.
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    members: Mapped[list["ConversationMember"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )

    @property
    def is_group(self) -> bool:
        return self.type == "group"

    @property
    def member_users(self) -> list["User"]:
        """The people in this conversation, flattened past the join rows."""
        return [m.user for m in self.members]


class ConversationMember(Base):
    """Membership, role, and read position."""

    __tablename__ = "conversation_members"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_member_pair"),
        CheckConstraint("role IN ('admin', 'member')", name="ck_member_role"),
        Index("ix_members_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16), default="member")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # Unread count = messages in this conversation with id > last_read_message_id.
    last_read_message_id: Mapped[int] = mapped_column(Integer, default=0)
    muted: Mapped[bool] = mapped_column(Boolean, default=False)

    conversation: Mapped["Conversation"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="memberships")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("type IN ('text', 'system')", name="ck_message_type"),
        Index("ix_messages_conv_created", "conversation_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    # Null for system messages ("Alice added Bob").
    sender_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    type: Mapped[str] = mapped_column(String(16), default="text")
    body: Mapped[str] = mapped_column(Text)
    reply_to_id: Mapped[Optional[int]] = mapped_column(ForeignKey("messages.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Soft delete so "This message was deleted" can render in place.
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
    sender: Mapped[Optional["User"]] = relationship()
    reply_to: Mapped[Optional["Message"]] = relationship(remote_side=[id])
    receipts: Mapped[list["MessageReceipt"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class MessageReceipt(Base):
    """Per-recipient delivery state — the source of the tick marks."""

    __tablename__ = "message_receipts"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_receipt_pair"),
        Index("ix_receipts_message", "message_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    message: Mapped["Message"] = relationship(back_populates="receipts")
