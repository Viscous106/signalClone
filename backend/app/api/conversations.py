from fastapi import APIRouter, HTTPException, Request, status

from app.core.deps import CurrentUser, DbSession
from app.db.models import (
    Conversation,
    ConversationMember,
    Message,
    User,
    pick_avatar_token,
)
from app.schemas.conversation import (
    AddMembersRequest,
    ConversationCreate,
    ConversationOut,
    ConversationUpdate,
    MarkReadRequest,
    MemberOut,
    MessageOut,
    DisappearingRequest,
)
from app.services import conversations as service
from app.services import groups as group_service
from app.services import disappearing
from app.services import receipts as receipt_service
from app.ws.manager import broadcast

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _bare(conversation: Conversation) -> Conversation:
    """Attach the sidebar extras a freshly built row has not got yet."""
    conversation.unread_count = 0
    conversation.last_message = None
    return conversation


def _require_membership(db, conversation_id: int, user: User) -> ConversationMember:
    """Every conversation route starts here: membership is the authorisation."""
    membership = service.membership_or_none(db, conversation_id, user.id)
    if membership is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not in this conversation")
    return membership


def _require_group_admin(db, conversation: Conversation, user: User) -> None:
    if not group_service.is_admin(db, conversation.id, user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only group admins can do that")


def _require_group(conversation: Conversation) -> None:
    if conversation.type != "group":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That is not a group")


def _announce(request: Request, db, conversation: Conversation, message: Message | None) -> None:
    """Tell current members what changed: the notice, then the new shape."""
    manager = request.app.state.ws_manager
    audience = receipt_service.member_ids(db, conversation.id)

    if message is not None:
        broadcast(
            manager,
            audience,
            {"type": "message.new", "payload": MessageOut.model_validate(message).model_dump(mode="json")},
        )
    broadcast(
        manager,
        audience,
        {
            "type": "conversation.updated",
            "payload": ConversationOut.model_validate(_bare(conversation)).model_dump(mode="json"),
        },
    )


@router.get("", response_model=list[ConversationOut])
def list_conversations(user: CurrentUser, db: DbSession) -> list[Conversation]:
    return service.list_for_user(db, user)


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate, user: CurrentUser, db: DbSession, request: Request
) -> Conversation:
    # A group is anything that names itself or brings a member list; otherwise
    # it is a direct chat with one other person.
    wants_group = payload.name is not None or payload.member_ids is not None

    if wants_group:
        return _create_group(payload, user, db, request)
    if payload.user_id is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Provide user_id for a direct chat, or name and member_ids"
        )
    return _create_direct(payload.user_id, user, db)


def _create_direct(other_id: int, user: User, db) -> Conversation:
    if other_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot start a chat with yourself")

    other = db.get(User, other_id)
    if other is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such user")

    existing = service.find_direct(db, user.id, other.id)
    if existing is not None:
        return _bare(existing)

    conversation = Conversation(
        type="direct", created_by=user.id, avatar_token=pick_avatar_token(other.phone)
    )
    db.add(conversation)
    db.flush()
    db.add_all([
        ConversationMember(conversation_id=conversation.id, user_id=user.id),
        ConversationMember(conversation_id=conversation.id, user_id=other.id),
    ])
    db.commit()
    db.refresh(conversation)
    return _bare(conversation)


def _create_group(
    payload: ConversationCreate, user: User, db, request: Request
) -> Conversation:
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A group needs a name")

    # Passing yourself is harmless but must not create a second membership row.
    member_ids = [uid for uid in dict.fromkeys(payload.member_ids or []) if uid != user.id]
    if not member_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A group needs at least one other person")

    users = db.query(User).filter(User.id.in_(member_ids)).all()
    if len(users) != len(member_ids):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "One of those people does not exist")

    conversation = group_service.create(db, user, name, [u.id for u in users])
    _announce(request, db, conversation, None)
    return _bare(conversation)


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: int, user: CurrentUser, db: DbSession) -> Conversation:
    _require_membership(db, conversation_id, user)
    return _bare(db.get(Conversation, conversation_id))


@router.patch("/{conversation_id}", response_model=ConversationOut)
def rename_conversation(
    conversation_id: int,
    payload: ConversationUpdate,
    user: CurrentUser,
    db: DbSession,
    request: Request,
) -> Conversation:
    _require_membership(db, conversation_id, user)
    conversation = db.get(Conversation, conversation_id)
    _require_group(conversation)
    _require_group_admin(db, conversation, user)

    group_service.rename(db, conversation, user, payload.name)
    notice = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id, Message.type == "system")
        .order_by(Message.id.desc())
        .first()
    )
    _announce(request, db, conversation, notice)
    return _bare(conversation)


@router.patch("/{conversation_id}/disappearing", response_model=ConversationOut)
def set_disappearing(
    conversation_id: int,
    payload: DisappearingRequest,
    user: CurrentUser,
    db: DbSession,
    request: Request,
) -> Conversation:
    """Set the thread's disappearing-message timer.

    Conversation-wide and announced in the thread, because a message quietly
    given a lifetime by somebody else is a surprise nobody should get. In a
    group this follows the same rule as renaming: admins only.
    """
    _require_membership(db, conversation_id, user)
    conversation = db.get(Conversation, conversation_id)
    seconds = disappearing.require_valid(payload.seconds)

    if conversation.is_group:
        _require_group_admin(db, conversation, user)

    if conversation.disappear_seconds == seconds:
        # Nothing changed, so nothing to announce.
        return _bare(conversation)

    conversation.disappear_seconds = seconds
    notice = group_service.system_message(
        db,
        conversation,
        f"{user.display_name} turned off disappearing messages"
        if seconds == 0
        else f"{user.display_name} set disappearing messages to {disappearing.label(seconds)}",
    )
    db.commit()
    db.refresh(conversation)

    _announce(request, db, conversation, notice)
    return _bare(conversation)


@router.get("/{conversation_id}/members", response_model=list[MemberOut])
def list_members(
    conversation_id: int, user: CurrentUser, db: DbSession
) -> list[ConversationMember]:
    _require_membership(db, conversation_id, user)
    return group_service.members_of(db, conversation_id)


@router.post("/{conversation_id}/members", response_model=list[MemberOut])
def add_members(
    conversation_id: int,
    payload: AddMembersRequest,
    user: CurrentUser,
    db: DbSession,
    request: Request,
) -> list[ConversationMember]:
    _require_membership(db, conversation_id, user)
    conversation = db.get(Conversation, conversation_id)
    _require_group(conversation)
    _require_group_admin(db, conversation, user)

    users = db.query(User).filter(User.id.in_(payload.user_ids)).all()
    if len(users) != len(set(payload.user_ids)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "One of those people does not exist")

    added = group_service.add_members(db, conversation, user, users)
    if added:
        notice = (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id, Message.type == "system")
            .order_by(Message.id.desc())
            .first()
        )
        _announce(request, db, conversation, notice)
    return group_service.members_of(db, conversation_id)


@router.delete("/{conversation_id}/members/{user_id}", response_model=list[MemberOut])
def remove_member(
    conversation_id: int,
    user_id: int,
    user: CurrentUser,
    db: DbSession,
    request: Request,
) -> list[ConversationMember]:
    _require_membership(db, conversation_id, user)
    conversation = db.get(Conversation, conversation_id)
    _require_group(conversation)

    # Anyone may leave; only an admin may remove somebody else.
    if user_id != user.id:
        _require_group_admin(db, conversation, user)

    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such user")

    removed = group_service.remove_member(db, conversation, user, target)
    if removed is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "They are not in this group")

    notice = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id, Message.type == "system")
        .order_by(Message.id.desc())
        .first()
    )
    _announce(request, db, conversation, notice)
    # The departed need to drop it from their own sidebar.
    broadcast(
        request.app.state.ws_manager,
        [user_id],
        {"type": "conversation.removed", "payload": {"conversation_id": conversation_id}},
    )
    return group_service.members_of(db, conversation_id)


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
