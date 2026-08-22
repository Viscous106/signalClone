"""Mocked auth. No passwords: possessing the phone number is proof of identity.

Real verification and cryptographic key exchange are explicitly out of scope
per the assignment brief.
"""

from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings

SESSION_COOKIE = "session"


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> int | None:
    """Return the user id, or None for anything malformed, expired, or forged."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        return None


def verify_otp(code: str) -> bool:
    return code == get_settings().mock_otp
