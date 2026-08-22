"""Idempotent seed data so the app is usable the moment it boots."""

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

PEOPLE = [
    ("+15550000001", "alice", "Alice Chen", "Coffee enthusiast ☕"),
    ("+15550000002", "bob", "Bob Martinez", "Available"),
    ("+15550000003", "carol", "Carol Nwosu", "Out for a run \U0001F3C3"),
    ("+15550000004", "dave", "Dave Kim", None),
    ("+15550000005", "erin", "Erin Patel", "Do not disturb"),
]

DIRECT_1 = [
    ("alice", "Hey! Are we still on for tomorrow?"),
    ("bob", "Absolutely. 7pm still work for you?"),
    ("alice", "Perfect. I'll book the table."),
    ("bob", "Nice one \U0001F389"),
    ("alice", "Booked — corner table by the window."),
]

DIRECT_2 = [
    ("carol", "Did you see the design review notes?"),
    ("alice", "Reading them now. The spacing comments are fair."),
    ("carol", "Agreed. I'll push a fix tonight."),
    ("alice", "Thanks Carol."),
]

GROUP = [
    ("alice", "Welcome to the weekend trip planning chat!"),
    ("bob", "Finally. Where are we going?"),
    ("carol", "I vote coast."),
    ("dave", "Coast works. I can drive."),
    ("alice", "Coast it is. I'll start a list."),
    ("bob", "I'll handle snacks \U0001F35F"),
    ("carol", "Sunscreen. Learn from last time."),
]


def _now_minus(minutes: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=minutes)


def _add_messages(db: Session, conv: Conversation, users: dict[str, User], script, start: int):
    """Lay the script out backwards from `start` minutes ago, 3 minutes apart."""
    total = len(script)
    # Compute every timestamp up front: `last_message_at` has to equal the newest
    # message exactly, and calling now() twice drifts by microseconds.
    stamps = [_now_minus(start + (total - i - 1) * 3) for i in range(total)]
    for (username, body), created_at in zip(script, stamps):
        db.add(
            Message(
                conversation_id=conv.id,
                sender_id=users[username].id,
                body=body,
                created_at=created_at,
            )
        )
    conv.last_message_at = stamps[-1]
    db.flush()


def seed(db: Session) -> None:
    if db.query(User).count() > 0:
        return  # already seeded

    users: dict[str, User] = {}
    for phone, username, name, about in PEOPLE:
        u = User(
            phone=phone,
            username=username,
            display_name=name,
            about=about,
            avatar_token=pick_avatar_token(phone),
            last_seen_at=_now_minus(5),
        )
        db.add(u)
        users[username] = u
    db.flush()

    # Everyone knows Alice; Alice knows everyone.
    for username, u in users.items():
        if username == "alice":
            continue
        db.add(Contact(owner_id=users["alice"].id, contact_user_id=u.id))
        db.add(Contact(owner_id=u.id, contact_user_id=users["alice"].id))
    db.flush()

    def make_conv(kind: str, members: list[str], name: str | None = None) -> Conversation:
        conv = Conversation(
            type=kind,
            name=name,
            created_by=users[members[0]].id,
            avatar_token=pick_avatar_token(name or "".join(members)),
        )
        db.add(conv)
        db.flush()
        for i, username in enumerate(members):
            db.add(
                ConversationMember(
                    conversation_id=conv.id,
                    user_id=users[username].id,
                    role="admin" if (kind == "group" and i == 0) else "member",
                )
            )
        db.flush()
        return conv

    d1 = make_conv("direct", ["alice", "bob"])
    d2 = make_conv("direct", ["alice", "carol"])
    grp = make_conv("group", ["alice", "bob", "carol", "dave"], name="Weekend Trip")

    # Group is most recent, so it lands at the top of the sidebar.
    _add_messages(db, d2, users, DIRECT_2, start=180)
    _add_messages(db, d1, users, DIRECT_1, start=45)
    _add_messages(db, grp, users, GROUP, start=4)

    _mark_everything_read(db)
    # ...then leave the newest group chatter unread, so the sidebar opens with
    # one badge rather than a badge on everything.
    _leave_unread(db, grp, users["alice"], count=2)

    db.commit()


def _mark_everything_read(db: Session) -> None:
    newest = dict(
        db.query(Message.conversation_id, func.max(Message.id))
        .group_by(Message.conversation_id)
        .all()
    )
    for member in db.query(ConversationMember).all():
        member.last_read_message_id = newest.get(member.conversation_id, 0)
    db.flush()


def _leave_unread(db: Session, conv: Conversation, user: User, count: int) -> None:
    """Rewind one person's read cursor so `count` messages show as unread."""
    recent = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id, Message.sender_id != user.id)
        .order_by(Message.id.desc())
        .limit(count)
        .all()
    )
    if not recent:
        return
    member = (
        db.query(ConversationMember).filter_by(conversation_id=conv.id, user_id=user.id).one()
    )
    member.last_read_message_id = recent[-1].id - 1
    db.flush()
