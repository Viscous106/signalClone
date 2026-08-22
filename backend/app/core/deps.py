from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import SESSION_COOKIE, decode_access_token
from app.db.models import User
from app.db.session import get_db

UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
)


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User:
    if not session:
        raise UNAUTHORIZED

    user_id = decode_access_token(session)
    if user_id is None:
        raise UNAUTHORIZED

    # The token may outlive the account it names.
    user = db.get(User, user_id)
    if user is None:
        raise UNAUTHORIZED
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]
