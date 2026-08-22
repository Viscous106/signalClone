from pydantic import BaseModel

from app.schemas.common import NonBlank, Phone


class AuthStartRequest(BaseModel):
    phone: Phone


class AuthStartResponse(BaseModel):
    otp_sent: bool
    is_new: bool


class AuthVerifyRequest(BaseModel):
    phone: Phone
    code: str
    # Required only when registering; ignored for a returning user.
    display_name: NonBlank | None = None
