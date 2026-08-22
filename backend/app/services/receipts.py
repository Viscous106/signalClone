"""Delivery and read receipts — the source of Signal's tick marks.

A message's status is the *weakest* state across everyone else in the
conversation: one unread recipient keeps a group message on double-grey.
"""

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import ConversationMember, Message, MessageReceipt

SENT = "sent"
DELIVERED = "delivered"
READ = "read"


def member_ids(db: Session, conversation_id: int) -> list[int]:
    return [
        row[0]
        for row in db.query(ConversationMember.user_id)
        .filter(ConversationMember.conversation_id == conversation_id)
        .all()
    ]


def _receipt(db: Session, message_id: int, user_id: int) -> MessageReceipt:
    existing = db.query(MessageReceipt).filter_by(message_id=message_id, user_id=user_id).first()
    if existing:
        return existing
    receipt = MessageReceipt(message_id=message_id, user_id=user_id)
    db.add(receipt)
    return receipt


def mark_delivered(db: Session, user_id: int, message_ids: list[int]) -> list[Message]:
    """Record that `user_id` has received these messages. Returns those changed."""
    if not message_ids:
        return []

    messages = (
        db.query(Message)
        .filter(Message.id.in_(message_ids), Message.sender_id != user_id)
        .all()
    )
    changed = []
    now = datetime.now(timezone.utc)
    for message in messages:
        receipt = _receipt(db, message.id, user_id)
        if receipt.delivered_at is None:
            receipt.delivered_at = now
            changed.append(message)
    if changed:
        db.commit()
    return changed


def deliver_backlog(db: Session, user_id: int) -> list[Message]:
    """Everything waiting for me while I was offline.

    Called on connect, so a message sent to an absent recipient still becomes
    delivered the moment they reappear.
    """
    mine = db.query(ConversationMember.conversation_id).filter(
        ConversationMember.user_id == user_id
    )
    pending = (
        db.query(Message)
        .outerjoin(
            MessageReceipt,
            (MessageReceipt.message_id == Message.id) & (MessageReceipt.user_id == user_id),
        )
        .filter(
            Message.conversation_id.in_(mine),
            Message.sender_id != user_id,
            MessageReceipt.delivered_at.is_(None),
        )
        .all()
    )
    return mark_delivered(db, user_id, [m.id for m in pending])


def mark_read(db: Session, user_id: int, conversation_id: int, up_to_id: int) -> list[Message]:
    """Read everything up to `up_to_id`. Delivery is implied by reading."""
    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.id <= up_to_id,
            Message.sender_id != user_id,
        )
        .all()
    )
    changed = []
    now = datetime.now(timezone.utc)
    for message in messages:
        receipt = _receipt(db, message.id, user_id)
        if receipt.read_at is None:
            receipt.delivered_at = receipt.delivered_at or now
            receipt.read_at = now
            changed.append(message)
    if changed:
        db.commit()
    return changed


def statuses_for(db: Session, messages: list[Message], viewer_id: int) -> dict[int, str]:
    """Status per message, for the messages `viewer_id` sent. One query."""
    mine = [m for m in messages if m.sender_id == viewer_id]
    if not mine:
        return {}

    conversation_ids = {m.conversation_id for m in mine}
    others_per_conversation = dict(
        db.query(ConversationMember.conversation_id, func.count(ConversationMember.id))
        .filter(
            ConversationMember.conversation_id.in_(conversation_ids),
            ConversationMember.user_id != viewer_id,
        )
        .group_by(ConversationMember.conversation_id)
        .all()
    )

    # count() over a nullable column counts only the non-nulls.
    rows = (
        db.query(
            MessageReceipt.message_id,
            func.count(MessageReceipt.delivered_at),
            func.count(MessageReceipt.read_at),
        )
        .filter(
            MessageReceipt.message_id.in_([m.id for m in mine]),
            MessageReceipt.user_id != viewer_id,
        )
        .group_by(MessageReceipt.message_id)
        .all()
    )
    tallies = {message_id: (delivered, read) for message_id, delivered, read in rows}

    statuses = {}
    for message in mine:
        others = others_per_conversation.get(message.conversation_id, 0)
        delivered, read = tallies.get(message.id, (0, 0))
        if others == 0:
            statuses[message.id] = SENT
        elif read >= others:
            statuses[message.id] = READ
        elif delivered >= others:
            statuses[message.id] = DELIVERED
        else:
            statuses[message.id] = SENT
    return statuses


def attach_statuses(db: Session, messages: list[Message], viewer_id: int) -> None:
    statuses = statuses_for(db, messages, viewer_id)
    for message in messages:
        # Left as None on incoming messages: ticks belong to the sender.
        message.status = statuses.get(message.id)
