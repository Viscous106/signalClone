from pydantic import BaseModel, model_validator

from app.schemas.common import Phone


class ContactCreate(BaseModel):
    phone: Phone | None = None
    user_id: int | None = None

    @model_validator(mode="after")
    def one_identifier(self):
        if (self.phone is None) == (self.user_id is None):
            raise ValueError("provide exactly one of phone or user_id")
        return self
