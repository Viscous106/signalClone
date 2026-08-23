"""Disappearing messages.

The timer is a property of the conversation, not of the sender: everyone in a
thread sees the same duration, and changing it announces itself with a system
message. Each message is stamped with a fixed `expires_at` when it is sent, so
the thread expires identically for every member regardless of when they read.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Query, Session

from app.db.models import Conversation, Message

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


def expiry_for(conversation: Conversation, sent_at: datetime) -> datetime | None:
    """When a message sent now should vanish, or None if the timer is off."""
    seconds = conversation.disappear_seconds or 0
    if seconds <= 0:
        return None
    if sent_at.tzinfo is None:
        # SQLite hands back naive datetimes even for timezone=True columns.
        sent_at = sent_at.replace(tzinfo=timezone.utc)
    return sent_at + timedelta(seconds=seconds)


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
