from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import or_

from app.core.deps import CurrentUser, DbSession
from app.db.models import Contact, User
from app.schemas.contact import ContactCreate
from app.schemas.conversation import UserBrief

router = APIRouter(prefix="/api", tags=["contacts"])


@router.get("/users/search", response_model=list[UserBrief])
def search_users(user: CurrentUser, db: DbSession, q: str = Query("")) -> list[User]:
    """Find people to start a chat with, by name, username, or phone."""
    term = q.strip()
    if not term:
        # A blank query must not dump the whole user table.
        return []

    like = f"%{term}%"
    return (
        db.query(User)
        .filter(
            User.id != user.id,
            or_(User.display_name.ilike(like), User.phone.ilike(like), User.username.ilike(like)),
        )
        .order_by(User.display_name)
        .limit(20)
        .all()
    )


@router.get("/contacts", response_model=list[UserBrief])
def list_contacts(user: CurrentUser, db: DbSession) -> list[User]:
    return (
        db.query(User)
        .join(Contact, Contact.contact_user_id == User.id)
        .filter(Contact.owner_id == user.id)
        .order_by(User.display_name)
        .all()
    )


@router.post("/contacts", response_model=UserBrief, status_code=status.HTTP_201_CREATED)
def add_contact(payload: ContactCreate, user: CurrentUser, db: DbSession) -> User:
    target = (
        db.get(User, payload.user_id)
        if payload.user_id is not None
        else db.query(User).filter(User.phone == payload.phone).first()
    )
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That number is not on Signal")
    if target.id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot add yourself")

    already = (
        db.query(Contact).filter_by(owner_id=user.id, contact_user_id=target.id).first() is not None
    )
    if not already:
        db.add(Contact(owner_id=user.id, contact_user_id=target.id))
        db.commit()
    return target


@router.delete("/contacts/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_contact(user_id: int, user: CurrentUser, db: DbSession) -> Response:
    db.query(Contact).filter_by(owner_id=user.id, contact_user_id=user_id).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
