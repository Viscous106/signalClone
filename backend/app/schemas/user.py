from datetime import datetime

import re

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

from app.db.models import avatar_pair
from app.schemas.common import NonBlank

# Roughly 512KB of base64, which comfortably holds the 256px square the client
# produces while refusing anything that would bloat the row.
MAX_AVATAR_CHARS = 700_000

_IMAGE_DATA_URI = re.compile(r"^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$")
_HTTP_URL = re.compile(r"^https?://\S+$")


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    username: str | None
    display_name: str
    avatar_url: str | None
    avatar_token: str
    about: str | None
    last_seen_at: datetime | None
    created_at: datetime

    @computed_field
    @property
    def avatar_color(self) -> str:
        return avatar_pair(self.avatar_token)[0]

    @computed_field
    @property
    def avatar_fg(self) -> str:
        return avatar_pair(self.avatar_token)[1]


class UserUpdate(BaseModel):
    display_name: NonBlank | None = None
    about: str | None = None
    avatar_url: str | None = None

    @field_validator("avatar_url")
    @classmethod
    def check_avatar(cls, value: str | None) -> str | None:
        """Either an http(s) link or an inline image — nothing else.

        Without this, `javascript:` or an HTML data URI would be stored and
        later rendered straight into an `img` src.
        """
        if value is None or value == "":
            return None
        if len(value) > MAX_AVATAR_CHARS:
            raise ValueError("that image is too large")
        if _IMAGE_DATA_URI.match(value) or _HTTP_URL.match(value):
            return value
        raise ValueError("must be an https link or an inline image")
