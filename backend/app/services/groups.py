"""Group creation and membership.

A group is a `Conversation` with `type='group'` and more members, so messaging,
receipts, and the sidebar all reuse the direct-chat code paths untouched. Only
the membership and admin rules live here.
"""

from sqlalchemy.orm import Session

from app.db.models import Conversation, ConversationMember, Message, User, pick_avatar_token

ADMIN = "admin"
MEMBER = "member"


def system_message(db: Session, conversation: Conversation, body: str) -> Message:
    """Record a membership change in the thread itself, the way Signal does.

    The rendered English text is stored rather than a structured event. That
    trades localisation for simplicity, which is the right call at this scope.
    """
    message = Message(conversation_id=conversation.id, sender_id=None, type="system", body=body)
    db.add(message)
    db.flush()
    # A notice is activity: the group should rise in the sidebar.
    conversation.last_message_at = message.created_at
    return message


def members_of(db: Session, conversation_id: int) -> list[ConversationMember]:
    return (
        db.query(ConversationMember)
        .filter(ConversationMember.conversation_id == conversation_id)
        .order_by(ConversationMember.joined_at, ConversationMember.id)
        .all()
    )


def is_admin(db: Session, conversation_id: int, user_id: int) -> bool:
    membership = (
        db.query(ConversationMember)
        .filter_by(conversation_id=conversation_id, user_id=user_id)
        .first()
    )
    return membership is not None and membership.role == ADMIN


def create(db: Session, creator: User, name: str, member_ids: list[int]) -> Conversation:
    """Caller has already validated the name and that the members exist."""
    conversation = Conversation(
        type="group",
        name=name,
        created_by=creator.id,
        avatar_token=pick_avatar_token(name),
    )
    db.add(conversation)
    db.flush()

    db.add(ConversationMember(conversation_id=conversation.id, user_id=creator.id, role=ADMIN))
    for user_id in member_ids:
        db.add(ConversationMember(conversation_id=conversation.id, user_id=user_id, role=MEMBER))
    db.flush()

    system_message(db, conversation, f"{creator.display_name} created the group")
    db.commit()
    db.refresh(conversation)
    return conversation


def add_members(
    db: Session, conversation: Conversation, actor: User, users: list[User]
) -> list[User]:
    """Add whoever is not already in. Returns those actually added."""
    existing = {m.user_id for m in members_of(db, conversation.id)}
    added = [u for u in users if u.id not in existing]

    for user in added:
        db.add(ConversationMember(conversation_id=conversation.id, user_id=user.id, role=MEMBER))
    if added:
        db.flush()
        names = ", ".join(u.display_name for u in added)
        system_message(db, conversation, f"{actor.display_name} added {names}")
        db.commit()
    return added


def remove_member(
    db: Session, conversation: Conversation, actor: User, target: User
) -> ConversationMember | None:
    """Remove `target`. Returns the membership that was removed, or None."""
    membership = (
        db.query(ConversationMember)
        .filter_by(conversation_id=conversation.id, user_id=target.id)
        .first()
    )
    if membership is None:
        return None

    leaving = actor.id == target.id
    db.delete(membership)
    db.flush()

    if leaving:
        system_message(db, conversation, f"{target.display_name} left the group")
    else:
        system_message(
            db, conversation, f"{actor.display_name} removed {target.display_name}"
        )

    _ensure_an_admin_remains(db, conversation)
    db.commit()
    return membership


def _ensure_an_admin_remains(db: Session, conversation: Conversation) -> None:
    """Promote the longest-standing member if the last admin has gone.

    A group with no admin can never be administered again — nobody could add,
    remove, or rename anything.
    """
    remaining = members_of(db, conversation.id)
    if not remaining or any(m.role == ADMIN for m in remaining):
        return
    remaining[0].role = ADMIN
    db.flush()


def rename(db: Session, conversation: Conversation, actor: User, name: str) -> Conversation:
    conversation.name = name
    db.flush()
    system_message(db, conversation, f'{actor.display_name} changed the group name to "{name}"')
    db.commit()
    db.refresh(conversation)
    return conversation
