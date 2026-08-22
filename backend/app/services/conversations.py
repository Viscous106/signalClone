"""Reads for the conversation sidebar.

Kept out of the router because the interesting part is the query plan: the
number of statements must not grow with the number of conversations.
"""

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.models import Conversation, ConversationMember, Message, User


def membership_or_none(
    db: Session, conversation_id: int, user_id: int
) -> ConversationMember | None:
    return (
        db.query(ConversationMember)
        .filter_by(conversation_id=conversation_id, user_id=user_id)
        .first()
    )


def _last_message_per_conversation(db: Session, conversation_ids: list[int]) -> dict[int, Message]:
    """Newest message per conversation, in one statement.

    Ids are monotonic, so MAX(id) is the newest — and it matches the id
    comparison used for unread counts.
    """
    newest_ids = (
        select(func.max(Message.id))
        .where(Message.conversation_id.in_(conversation_ids))
        .group_by(Message.conversation_id)
    )
    messages = (
        db.query(Message)
        .filter(Message.id.in_(newest_ids))
        .options(joinedload(Message.sender))
        .all()
    )
    return {m.conversation_id: m for m in messages}


def _unread_counts(db: Session, conversation_ids: list[int], user_id: int) -> dict[int, int]:
    """Messages newer than my read cursor, in one statement.

    Joining membership rather than reading last_read_message_id per row keeps
    this to a single grouped query.
    """
    rows = (
        db.query(Message.conversation_id, func.count(Message.id))
        .join(
            ConversationMember,
            and_(
                ConversationMember.conversation_id == Message.conversation_id,
                ConversationMember.user_id == user_id,
            ),
        )
        .filter(
            Message.conversation_id.in_(conversation_ids),
            Message.id > ConversationMember.last_read_message_id,
            Message.deleted_at.is_(None),
            # "Alice added Bob" is not an unread message. It belongs in the
            # thread and in the sidebar preview, but badging it would mean
            # every group change nags everyone.
            Message.type != "system",
            # My own messages are never unread to me.
            or_(Message.sender_id.is_(None), Message.sender_id != user_id),
        )
        .group_by(Message.conversation_id)
        .all()
    )
    return dict(rows)


def list_for_user(db: Session, user: User) -> list[Conversation]:
    """Conversations I am in, newest activity first, decorated for the sidebar."""
    conversation_ids = [
        row[0]
        for row in db.query(ConversationMember.conversation_id)
        .filter(ConversationMember.user_id == user.id)
        .all()
    ]
    if not conversation_ids:
        return []

    conversations = (
        db.query(Conversation)
        .filter(Conversation.id.in_(conversation_ids))
        .options(selectinload(Conversation.members).joinedload(ConversationMember.user))
        # id as a tiebreaker: two messages can land in the same microsecond.
        .order_by(Conversation.last_message_at.desc(), Conversation.id.desc())
        .all()
    )

    last_messages = _last_message_per_conversation(db, conversation_ids)
    unread = _unread_counts(db, conversation_ids, user.id)

    for conversation in conversations:
        # Attached for the response model to read; not persisted.
        conversation.last_message = last_messages.get(conversation.id)
        conversation.unread_count = unread.get(conversation.id, 0)

    return conversations


def find_direct(db: Session, user_id: int, other_id: int) -> Conversation | None:
    """The existing one-to-one chat between two people, if there is one.

    Without this check the sidebar accumulates duplicate chats for one person.
    """
    mine = select(ConversationMember.conversation_id).where(ConversationMember.user_id == user_id)
    theirs = select(ConversationMember.conversation_id).where(
        ConversationMember.user_id == other_id
    )
    return (
        db.query(Conversation)
        .filter(
            Conversation.type == "direct",
            Conversation.id.in_(mine),
            Conversation.id.in_(theirs),
        )
        .first()
    )
