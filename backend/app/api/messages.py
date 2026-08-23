from fastapi import APIRouter, HTTPException, Query, Request, status

from app.core.deps import CurrentUser, DbSession
from app.db.models import Conversation, Message
from app.schemas.conversation import MessageCreate, MessageOut, ReactionRequest
from app.services import attachments as attachment_service
from app.services import conversations as service
from app.services import disappearing
from app.services import messages as message_service
from app.services import reactions as reaction_service
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

    # Opportunistic: there is no scheduler, so reading a thread is what
    # actually reclaims its lapsed rows.
    disappearing.sweep(db, conversation_id)

    query = db.query(Message).filter(Message.conversation_id == conversation_id)
    if before is not None:
        query = query.filter(Message.id < before)
    # Belt and braces: anything that lapsed since the sweep is still hidden.
    messages = disappearing.exclude_expired(query).order_by(Message.id.desc()).limit(limit).all()

    # Ticks come from the database, so they survive a reload.
    receipt_service.attach_statuses(db, messages, user.id)
    message_service.attach_quotes(db, messages)
    reaction_service.attach(db, messages, user.id)
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

    body = payload.body.strip()
    # An image with no caption is a real message; an empty text one is not.
    if not body and not payload.attachments:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A message needs text or an attachment")

    # Raises 400 on anything oversized or of an unsupported type, before a row
    # is written — a rejected upload should leave no trace.
    files = attachment_service.build(payload.attachments)

    quoted = None
    if payload.reply_to_id is not None:
        quoted = db.get(Message, payload.reply_to_id)
        # Quoting across conversations would leak a message into a thread its
        # members were never in.
        if quoted is None or quoted.conversation_id != conversation_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That message is not in this chat")

    conversation = db.get(Conversation, conversation_id)

    message = Message(
        conversation_id=conversation_id,
        sender_id=user.id,
        body=body,
        reply_to_id=payload.reply_to_id,
    )
    db.add(message)
    db.flush()
    # The duration only; the clock starts when it has been read.
    message.expire_seconds = disappearing.snapshot_seconds(conversation)
    for file in files:
        file.message_id = message.id
        db.add(file)

    # Keep the sidebar's sort key in step with the newest message.
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
    message_service.attach_quotes(db, [message])
    reaction_service.attach(db, [message], user.id)
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


@router.post("/{conversation_id}/messages/{message_id}/reactions", response_model=MessageOut)
def react(
    conversation_id: int,
    message_id: int,
    payload: ReactionRequest,
    user: CurrentUser,
    db: DbSession,
    request: Request,
) -> Message:
    """Set, replace, or clear the caller's reaction on one message.

    One endpoint rather than add/remove: the interaction is a toggle, and the
    client should not have to know which of the two it is about to perform.
    """
    _require_membership(db, conversation_id, user.id)

    emoji = payload.emoji.strip()
    if emoji and not reaction_service.is_allowed(emoji):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That emoji is not in the reaction tray")

    message = db.get(Message, message_id)
    if message is None or message.conversation_id != conversation_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such message in this chat")

    reaction_service.toggle(db, message, user, emoji)
    db.refresh(message)

    receipt_service.attach_statuses(db, [message], user.id)
    message_service.attach_quotes(db, [message])
    reaction_service.attach(db, [message], user.id)

    # Everyone sees the pill, so everyone gets the event. Each recipient needs
    # their own `mine`, so the payload is rebuilt per person.
    manager = request.app.state.ws_manager
    for member_id in receipt_service.member_ids(db, conversation_id):
        reaction_service.attach(db, [message], member_id)
        broadcast(
            manager,
            [member_id],
            {
                "type": "message.reactions",
                "payload": {
                    "message_id": message.id,
                    "conversation_id": conversation_id,
                    "reactions": [dict(r) for r in message.reaction_pills],
                },
            },
        )

    # Restore the caller's view for the HTTP response.
    reaction_service.attach(db, [message], user.id)
    return message
