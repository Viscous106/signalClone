"""Disappearing messages.

The timer is a property of the conversation, not of the sender: everyone in a
thread sees the same duration, and changing it announces itself with a system
message.

The clock starts when a message has been **read**, not when it was sent. A
message nobody has opened has not served its purpose, and deleting it would
lose it unseen — so `expire_seconds` is snapshotted at send time and
`expires_at` stays null until the last other member reads it.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Query, Session

from app.db.models import Conversation, ConversationMember, Message, MessageReceipt

# Signal's own durations. 0 is off.
CHOICES: dict[int, str] = {
    0: "Off",
    30: "30 seconds",
    300: "5 minutes",
    3600: "1 hour",
    28800: "8 hours",
    86400: "1 day",
    604800: "1 week",
    2419200: "4 weeks",
}


def label(seconds: int) -> str:
    return CHOICES.get(seconds, f"{seconds} seconds")


def require_valid(seconds: int) -> int:
    if seconds not in CHOICES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not a supported timer duration")
    return seconds


def snapshot_seconds(conversation: Conversation) -> int:
    """The timer to stamp on a message being sent now. 0 means it stays.

    Taken at send time so that changing the thread's timer later cannot reach
    back and alter the lifetime of a message already delivered.
    """
    return max(0, conversation.disappear_seconds or 0)


def arm(db: Session, messages: list[Message]) -> list[Message]:
    """Start the clock on messages that everyone else has now read.

    Returns those newly armed, so the caller can tell their senders. A group
    message waits for the *last* other member: starting on the first read
    would delete it out from under everyone still to see it — the same
    weakest-state rule the delivery ticks use.
    """
    candidates = [
        m for m in messages if m.expire_seconds and m.expire_seconds > 0 and m.expires_at is None
    ]
    if not candidates:
        return []

    conversation_ids = {m.conversation_id for m in candidates}
    others_per_conversation = dict(
        db.query(ConversationMember.conversation_id, func.count(ConversationMember.id))
        .filter(ConversationMember.conversation_id.in_(conversation_ids))
        .group_by(ConversationMember.conversation_id)
        .all()
    )

    # count() over a nullable column counts only the non-nulls.
    read_counts = dict(
        db.query(MessageReceipt.message_id, func.count(MessageReceipt.read_at))
        .filter(MessageReceipt.message_id.in_([m.id for m in candidates]))
        .group_by(MessageReceipt.message_id)
        .all()
    )

    now = datetime.now(timezone.utc)
    armed = []
    for message in candidates:
        # Everyone but the sender has to have read it.
        others = max(0, others_per_conversation.get(message.conversation_id, 0) - 1)
        if others == 0:
            # A conversation with nobody else in it has no reader to wait for.
            continue
        if read_counts.get(message.id, 0) < others:
            continue
        message.expires_at = now + timedelta(seconds=message.expire_seconds)
        armed.append(message)

    if armed:
        db.commit()
    return armed


def exclude_expired(query: Query, now: datetime | None = None) -> Query:
    """Hide messages whose time is up.

    Filtering on read as well as sweeping means an expired message is invisible
    the instant it lapses, even if the sweep has not run yet.
    """
    moment = now or datetime.now(timezone.utc)
    return query.filter(or_(Message.expires_at.is_(None), Message.expires_at > moment))


def sweep(db: Session, conversation_id: int | None = None) -> int:
    """Delete what has lapsed. Returns how many rows went.

    Called opportunistically when a thread is read rather than on a timer:
    there is no scheduler in this build, and a thread nobody opens costs
    nothing by keeping rows a while longer.
    """
    query = db.query(Message).filter(
        Message.expires_at.is_not(None),
        Message.expires_at <= datetime.now(timezone.utc),
    )
    if conversation_id is not None:
        query = query.filter(Message.conversation_id == conversation_id)

    doomed = query.all()
    for message in doomed:
        db.delete(message)
    if doomed:
        db.commit()
    return len(doomed)
