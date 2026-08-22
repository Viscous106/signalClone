from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, DbSession
from app.db.models import Conversation, Message
from app.schemas.conversation import MessageCreate, MessageOut
from app.services import conversations as service

router = APIRouter(prefix="/api/conversations", tags=["messages"])


def _require_membership(db, conversation_id: int, user_id: int) -> None:
    if service.membership_or_none(db, conversation_id, user_id) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not in this conversation")


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(
    conversation_id: int,
    user: CurrentUser,
    db: DbSession,
    before: int | None = Query(None, description="Return messages older than this id"),
    limit: int = Query(50, le=100),
) -> list[Message]:
    """Newest first, cursor paginated so the client can scroll back forever."""
    _require_membership(db, conversation_id, user.id)

    query = db.query(Message).filter(Message.conversation_id == conversation_id)
    if before is not None:
        query = query.filter(Message.id < before)
    return query.order_by(Message.id.desc()).limit(limit).all()


@router.post(
    "/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED
)
def send_message(
    conversation_id: int, payload: MessageCreate, user: CurrentUser, db: DbSession
) -> Message:
    _require_membership(db, conversation_id, user.id)

    message = Message(
        conversation_id=conversation_id,
        sender_id=user.id,
        body=payload.body,
        reply_to_id=payload.reply_to_id,
    )
    db.add(message)
    db.flush()

    # Keep the sidebar's sort key in step with the newest message.
    conversation = db.get(Conversation, conversation_id)
    conversation.last_message_at = message.created_at

    db.commit()
    db.refresh(message)
    return message
