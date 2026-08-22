from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Response, status

from app.core.config import get_settings
from app.core.deps import DbSession
from app.core.security import SESSION_COOKIE, create_access_token, verify_otp
from app.db.models import User, pick_avatar_color
from app.schemas.auth import AuthStartRequest, AuthStartResponse, AuthVerifyRequest
from app.schemas.user import UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_session_cookie(response: Response, user_id: int) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        create_access_token(user_id),
        httponly=True,  # unreadable from JS, so XSS cannot lift the session
        samesite="lax",
        secure=False,  # dev over http; flip on when deployed behind TLS
        max_age=settings.jwt_expire_days * 24 * 3600,
        path="/",
    )


@router.post("/start", response_model=AuthStartResponse)
def start(payload: AuthStartRequest, db: DbSession) -> AuthStartResponse:
    """Step 1: 'send' the OTP. It is always the same code — see brief."""
    exists = db.query(User).filter(User.phone == payload.phone).first() is not None
    return AuthStartResponse(otp_sent=True, is_new=not exists)


@router.post("/verify", response_model=UserOut)
def verify(payload: AuthVerifyRequest, db: DbSession, response: Response) -> User:
    """Step 2: check the code, then register or log in."""
    if not verify_otp(payload.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect verification code")

    user = db.query(User).filter(User.phone == payload.phone).first()

    if user is None:
        if not payload.display_name:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "A display name is required to register"
            )
        user = User(
            phone=payload.phone,
            display_name=payload.display_name,
            avatar_color=pick_avatar_color(payload.phone),
        )
        db.add(user)

    # Signing in is the freshest possible presence signal. A returning user's
    # display_name is deliberately left alone: only PATCH /users/me renames.
    user.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    _set_session_cookie(response, user.id)
    return user


@router.post("/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}
