from fastapi import APIRouter, HTTPException, Query, Request, status

from app.core.deps import CurrentUser, DbSession
from app.db.models import Conversation, Message
from app.schemas.conversation import MessageCreate, MessageOut
from app.services import conversations as service
from app.services import receipts as receipt_service
from app.ws.manager import broadcast

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
    messages = query.order_by(Message.id.desc()).limit(limit).all()

    # Ticks come from the database, so they survive a reload.
    receipt_service.attach_statuses(db, messages, user.id)
    return messages


@router.post(
    "/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED
)
def send_message(
    conversation_id: int,
    payload: MessageCreate,
    user: CurrentUser,
    db: DbSession,
    request: Request,
) -> Message:
    """Persist first, then fan out. The socket is never the source of truth."""
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

    manager = request.app.state.ws_manager
    everyone = receipt_service.member_ids(db, conversation_id)
    recipients = [uid for uid in everyone if uid != user.id]

    # Anyone with a socket open has it now; the rest get it when they connect.
    for online_user in manager.online_among(recipients):
        receipt_service.mark_delivered(db, online_user, [message.id])

    receipt_service.attach_statuses(db, [message], user.id)
    message.client_id = payload.client_id
    payload_out = MessageOut.model_validate(message).model_dump(mode="json")

    # Sender included: their other tabs need it too.
    broadcast(manager, everyone, {"type": "message.new", "payload": payload_out})

    if message.status != receipt_service.SENT:
        broadcast(
            manager,
            [user.id],
            {
                "type": "message.status",
                "payload": {
                    "message_id": message.id,
                    "conversation_id": conversation_id,
                    "status": message.status,
                },
            },
        )
    return message
