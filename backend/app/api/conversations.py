from fastapi import APIRouter, HTTPException, Request, status

from app.core.deps import CurrentUser, DbSession
from app.db.models import Conversation, ConversationMember, User, pick_avatar_color
from app.schemas.conversation import (
    ConversationCreate,
    ConversationOut,
    MarkReadRequest,
)
from app.services import conversations as service
from app.services import receipts as receipt_service
from app.ws.manager import broadcast

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _require_membership(db, conversation_id: int, user: User) -> ConversationMember:
    """Every conversation route starts here: membership is the authorisation."""
    membership = service.membership_or_none(db, conversation_id, user.id)
    if membership is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not in this conversation")
    return membership


@router.get("", response_model=list[ConversationOut])
def list_conversations(user: CurrentUser, db: DbSession) -> list[Conversation]:
    return service.list_for_user(db, user)


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate, user: CurrentUser, db: DbSession
) -> Conversation:
    if payload.user_id is None:
        # Group creation arrives in Phase 4.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "user_id is required for a direct chat")

    if payload.user_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot start a chat with yourself")

    other = db.get(User, payload.user_id)
    if other is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such user")

    existing = service.find_direct(db, user.id, other.id)
    if existing is not None:
        existing.unread_count = 0
        existing.last_message = None
        return existing

    conversation = Conversation(
        type="direct",
        created_by=user.id,
        avatar_color=pick_avatar_color(other.phone),
    )
    db.add(conversation)
    db.flush()
    db.add_all([
        ConversationMember(conversation_id=conversation.id, user_id=user.id),
        ConversationMember(conversation_id=conversation.id, user_id=other.id),
    ])
    db.commit()
    db.refresh(conversation)

    conversation.unread_count = 0
    conversation.last_message = None
    return conversation


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: int, user: CurrentUser, db: DbSession) -> Conversation:
    _require_membership(db, conversation_id, user)
    conversation = db.get(Conversation, conversation_id)
    conversation.unread_count = 0
    conversation.last_message = None
    return conversation


@router.post("/{conversation_id}/read")
def mark_read(
    conversation_id: int,
    payload: MarkReadRequest,
    user: CurrentUser,
    db: DbSession,
    request: Request,
) -> dict[str, int]:
    membership = _require_membership(db, conversation_id, user)
    # Never move the cursor backwards: an older tab must not resurrect badges.
    membership.last_read_message_id = max(membership.last_read_message_id, payload.message_id)
    db.commit()

    # Tell each sender their message has been read, so their ticks fill in.
    changed = receipt_service.mark_read(db, user.id, conversation_id, payload.message_id)
    manager = request.app.state.ws_manager
    for message in changed:
        if message.sender_id is None:
            continue
        broadcast(
            manager,
            [message.sender_id],
            {
                "type": "message.status",
                "payload": {
                    "message_id": message.id,
                    "conversation_id": conversation_id,
                    "status": receipt_service.READ,
                },
            },
        )
    return {"last_read_message_id": membership.last_read_message_id}
