from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field

from app.db.models import avatar_pair
from app.schemas.common import NonBlank


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
