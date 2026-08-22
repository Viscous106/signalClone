from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import NonBlank


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    username: str | None
    display_name: str
    avatar_url: str | None
    avatar_color: str
    about: str | None
    last_seen_at: datetime | None
    created_at: datetime


class UserUpdate(BaseModel):
    display_name: NonBlank | None = None
    about: str | None = None
    avatar_url: str | None = None
