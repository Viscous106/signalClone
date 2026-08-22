"""Give a brand-new account something to look at.

The seed populates the demo cast's own chats, which leaves anyone who registers
with their own number staring at an empty app — the first thing a reviewer
does. This hands them contacts, two direct threads with history, and a place in
the group, so the app is immediately usable rather than immediately empty.

Demo behaviour, switchable with `starter_chats=false`.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    Contact,
    Conversation,
    ConversationMember,
    Message,
    User,
    pick_avatar_token,
)

# Written as (who, text); "me" is the new account.
WITH_ALICE = [
    ("me", "Hey Alice, just set this up."),
    ("alice", "Welcome! It looks good on you."),
    ("alice", "Did you get the notes I sent over?"),
]

WITH_BOB = [
    ("bob", "Hey! Are we still on for tomorrow?"),
    ("me", "Yep, 7pm works."),
    ("bob", "Perfect, I'll book the table."),
]

GROUP_WELCOME = "{name} joined the group"


def _now_minus(minutes: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=minutes)


def _cast(db: Session) -> dict[str, User]:
    """The seeded demo users, by username. Empty if the seed never ran."""
    rows = (
        db.query(User)
        .filter(User.username.in_(["alice", "bob", "carol", "dave", "erin"]))
        .all()
    )
    return {u.username: u for u in rows if u.username}


def _direct(db: Session, me: User, other: User, script, start: int, unread: bool) -> Conversation:
    conversation = Conversation(
        type="direct", created_by=me.id, avatar_token=pick_avatar_token(other.phone)
    )
    db.add(conversation)
    db.flush()

    mine = ConversationMember(conversation_id=conversation.id, user_id=me.id)
    theirs = ConversationMember(conversation_id=conversation.id, user_id=other.id)
    db.add_all([mine, theirs])
    db.flush()

    total = len(script)
    # Every timestamp up front: `last_message_at` has to equal the newest
    # message exactly, and calling now() twice drifts by microseconds.
    stamps = [_now_minus(start + (total - i - 1) * 4) for i in range(total)]
    written = []
    for (who, body), created_at in zip(script, stamps):
        message = Message(
            conversation_id=conversation.id,
            sender_id=(me if who == "me" else other).id,
            body=body,
            created_at=created_at,
        )
        db.add(message)
        written.append(message)
    db.flush()

    conversation.last_message_at = stamps[-1]

    # Read cursors: everything read, unless this thread is meant to draw the eye.
    theirs.last_read_message_id = written[-1].id
    if unread:
        # Leave the trailing messages from the other person unread.
        theirs_first_unread = next(
            (m for m in written if m.sender_id == other.id), written[-1]
        )
        mine.last_read_message_id = theirs_first_unread.id - 1
    else:
        mine.last_read_message_id = written[-1].id

    db.flush()
    return conversation


def _join_group(db: Session, me: User) -> None:
    """Put the newcomer in the seeded group so they see a real thread."""
    group = db.query(Conversation).filter(Conversation.type == "group").order_by(Conversation.id).first()
    if group is None:
        return

    already = (
        db.query(ConversationMember).filter_by(conversation_id=group.id, user_id=me.id).first()
    )
    if already is not None:
        return

    newest = (
        db.query(func.max(Message.id)).filter(Message.conversation_id == group.id).scalar() or 0
    )
    db.add(
        ConversationMember(
            conversation_id=group.id,
            user_id=me.id,
            # Already caught up: the group is not the thread we want noticed.
            last_read_message_id=newest,
        )
    )
    db.flush()

    notice = Message(
        conversation_id=group.id,
        sender_id=None,
        type="system",
        body=GROUP_WELCOME.format(name=me.display_name),
        created_at=_now_minus(2),
    )
    db.add(notice)
    db.flush()
    group.last_message_at = notice.created_at


def give_starter_chats(db: Session, me: User) -> None:
    """Called once, when an account is first created."""
    cast = _cast(db)
    if not cast:
        return  # nothing seeded to introduce them to

    for user in cast.values():
        db.add(Contact(owner_id=me.id, contact_user_id=user.id))
        # Directional, so the demo users need the reverse entry to find them.
        db.add(Contact(owner_id=user.id, contact_user_id=me.id))
    db.flush()

    if "bob" in cast:
        _direct(db, me, cast["bob"], WITH_BOB, start=90, unread=False)
    if "alice" in cast:
        # Newest and unread, so it sits on top with the only badge.
        _direct(db, me, cast["alice"], WITH_ALICE, start=8, unread=True)

    _join_group(db, me)
    db.commit()
