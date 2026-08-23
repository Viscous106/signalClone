"""Seed data.

Two separate jobs, both idempotent so they can run on every boot:

* the **demo cast** and their conversations, so the app is never empty;
* the **demo owner** — one designated account with seeded history, recreated if
  it goes missing.

Everyone else who registers gets the cast as contacts and nothing more. Chats
are earned: nobody is dropped into a conversation they were not invited to.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    Contact,
    Conversation,
    ConversationMember,
    Message,
    MessageReceipt,
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

# The account the demo history belongs to.
OWNER_PHONE = "+919834758028"
OWNER_NAME = "Yash Virulkar"
OWNER_USERNAME = "yash"

GROUP_NAME = "Weekend Trip"

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

# The owner's own threads.
OWNER_WITH_ALICE = [
    ("owner", "Hey Alice, just set this up."),
    ("alice", "Welcome! It looks good on you."),
    ("alice", "Did you get the notes I sent over?"),
]

OWNER_WITH_BOB = [
    ("bob", "Hey! Are we still on for tomorrow?"),
    ("owner", "Yep, 7pm works."),
    ("bob", "Perfect, I'll book the table."),
]


def _now_minus(minutes: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=minutes)


def _get_or_create_user(
    db: Session, phone: str, username: str, display_name: str, about: str | None = None
) -> User:
    existing = db.query(User).filter(User.phone == phone).first()
    if existing is not None:
        return existing
    user = User(
        phone=phone,
        username=username,
        display_name=display_name,
        about=about,
        avatar_token=pick_avatar_token(phone),
        last_seen_at=_now_minus(5),
    )
    db.add(user)
    db.flush()
    return user


def _link_contacts(db: Session, a: User, b: User) -> None:
    """Contacts are directional, so both entries are needed."""
    for owner, other in ((a, b), (b, a)):
        exists = (
            db.query(Contact).filter_by(owner_id=owner.id, contact_user_id=other.id).first()
        )
        if exists is None:
            db.add(Contact(owner_id=owner.id, contact_user_id=other.id))
    db.flush()


def _add_messages(
    db: Session, conv: Conversation, cast: dict[str, User], script, start: int
) -> list[Message]:
    """Lay the script out backwards from `start` minutes ago, 3 minutes apart."""
    total = len(script)
    # Compute every timestamp up front: `last_message_at` has to equal the
    # newest message exactly, and calling now() twice drifts by microseconds.
    stamps = [_now_minus(start + (total - i - 1) * 3) for i in range(total)]
    written = []
    for (who, body), created_at in zip(script, stamps):
        message = Message(
            conversation_id=conv.id,
            sender_id=cast[who].id,
            body=body,
            created_at=created_at,
        )
        db.add(message)
        written.append(message)
    db.flush()
    conv.last_message_at = stamps[-1]
    return written


def _make_conversation(
    db: Session, kind: str, members: list[User], name: str | None = None
) -> Conversation:
    conv = Conversation(
        type=kind,
        name=name,
        created_by=members[0].id,
        avatar_token=pick_avatar_token(name or "".join(m.phone for m in members)),
    )
    db.add(conv)
    db.flush()
    for index, member in enumerate(members):
        db.add(
            ConversationMember(
                conversation_id=conv.id,
                user_id=member.id,
                role="admin" if (kind == "group" and index == 0) else "member",
            )
        )
    db.flush()
    return conv


def _mark_read(db: Session, conv: Conversation) -> None:
    """Everyone has seen everything in this conversation.

    Both halves matter: the read *cursor* clears the sidebar badge, and a
    *receipt* per recipient is what the sender's tick marks are derived from.
    Setting only the cursor leaves every message showing a single check.
    """
    members = db.query(ConversationMember).filter_by(conversation_id=conv.id).all()
    messages = db.query(Message).filter_by(conversation_id=conv.id).all()

    newest = max((m.id for m in messages), default=0)
    for member in members:
        member.last_read_message_id = newest

    for message in messages:
        for member in members:
            if member.user_id == message.sender_id:
                continue  # you do not receipt your own message
            existing = (
                db.query(MessageReceipt)
                .filter_by(message_id=message.id, user_id=member.user_id)
                .first()
            )
            if existing is not None:
                continue
            # A beat after it arrived, so the timeline reads sensibly.
            seen = message.created_at + timedelta(seconds=20)
            db.add(
                MessageReceipt(
                    message_id=message.id,
                    user_id=member.user_id,
                    delivered_at=seen,
                    read_at=seen,
                )
            )
    db.flush()


def _leave_unread(db: Session, conv: Conversation, user: User, count: int) -> None:
    """Rewind one person's read cursor so `count` messages show as unread.

    Their receipts lose `read_at` but keep `delivered_at`: the messages did
    arrive, so their senders should still see two outline checks rather than
    one.
    """
    recent = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id, Message.sender_id != user.id)
        .order_by(Message.id.desc())
        .limit(count)
        .all()
    )
    if not recent:
        return

    member = db.query(ConversationMember).filter_by(conversation_id=conv.id, user_id=user.id).one()
    member.last_read_message_id = recent[-1].id - 1

    for message in recent:
        receipt = (
            db.query(MessageReceipt)
            .filter_by(message_id=message.id, user_id=user.id)
            .first()
        )
        if receipt is not None:
            receipt.read_at = None
    db.flush()


def _ensure_cast(db: Session) -> dict[str, User]:
    cast = {}
    for phone, username, name, about in PEOPLE:
        cast[username] = _get_or_create_user(db, phone, username, name, about)
    # Everyone knows Alice; Alice knows everyone.
    for username, user in cast.items():
        if username != "alice":
            _link_contacts(db, cast["alice"], user)
    return cast


def _ensure_demo_chats(db: Session, cast: dict[str, User]) -> Conversation:
    """Alice's own threads and the group. Created once."""
    group = db.query(Conversation).filter_by(type="group", name=GROUP_NAME).first()
    if group is not None:
        return group

    d1 = _make_conversation(db, "direct", [cast["alice"], cast["bob"]])
    d2 = _make_conversation(db, "direct", [cast["alice"], cast["carol"]])
    group = _make_conversation(
        db, "group", [cast["alice"], cast["bob"], cast["carol"], cast["dave"]], name=GROUP_NAME
    )

    _add_messages(db, d2, cast, DIRECT_2, start=180)
    _add_messages(db, d1, cast, DIRECT_1, start=45)
    _add_messages(db, group, cast, GROUP, start=12)

    for conv in (d1, d2, group):
        _mark_read(db, conv)
    # Leave the newest group chatter unread for Alice, so her sidebar has a badge.
    _leave_unread(db, group, cast["alice"], count=2)
    return group


def _ensure_owner(db: Session, cast: dict[str, User], group: Conversation) -> User:
    """The designated demo account, recreated whenever it is missing."""
    existing = db.query(User).filter(User.phone == OWNER_PHONE).first()
    if existing is not None:
        return existing

    owner = _get_or_create_user(db, OWNER_PHONE, OWNER_USERNAME, OWNER_NAME)
    for user in cast.values():
        _link_contacts(db, owner, user)

    people = {**cast, "owner": owner}

    with_bob = _make_conversation(db, "direct", [owner, cast["bob"]])
    _add_messages(db, with_bob, people, OWNER_WITH_BOB, start=90)
    _mark_read(db, with_bob)

    # Newest and unread, so it sits on top carrying the only badge.
    with_alice = _make_conversation(db, "direct", [owner, cast["alice"]])
    _add_messages(db, with_alice, people, OWNER_WITH_ALICE, start=8)
    _mark_read(db, with_alice)
    _leave_unread(db, with_alice, owner, count=2)

    # A real membership, added by the group's admin.
    newest = (
        db.query(func.max(Message.id)).filter(Message.conversation_id == group.id).scalar() or 0
    )
    db.add(
        ConversationMember(
            conversation_id=group.id, user_id=owner.id, last_read_message_id=newest
        )
    )
    db.flush()

    notice = Message(
        conversation_id=group.id,
        sender_id=None,
        type="system",
        body=f"{cast['alice'].display_name} added {OWNER_NAME}",
        created_at=_now_minus(6),
    )
    db.add(notice)
    db.flush()
    group.last_message_at = notice.created_at
    return owner


def seed(db: Session) -> None:
    """Safe to run on every boot: each part is a no-op once it exists."""
    cast = _ensure_cast(db)
    group = _ensure_demo_chats(db, cast)
    _ensure_owner(db, cast, group)
    db.commit()
