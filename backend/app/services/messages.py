"""Message assembly — the parts a bubble needs that are not columns on it."""

from sqlalchemy.orm import Session

from app.db.models import Attachment, Message, User
from sqlalchemy import func


def attach_quotes(db: Session, messages: list[Message]) -> None:
    """Resolve `reply_to_id` into the flat snippet a reply renders above itself.

    One query for the quoted rows and one for their attachment counts, rather
    than walking the ORM relationship per message.
    """
    wanted = {m.reply_to_id for m in messages if m.reply_to_id}
    if not wanted:
        for message in messages:
            message.quote = None
        return

    rows = (
        db.query(Message, User.display_name)
        .outerjoin(User, User.id == Message.sender_id)
        .filter(Message.id.in_(wanted))
        .all()
    )
    counts = dict(
        db.query(Attachment.message_id, func.count(Attachment.id))
        .filter(Attachment.message_id.in_(wanted))
        .group_by(Attachment.message_id)
        .all()
    )

    quotes = {
        quoted.id: {
            "id": quoted.id,
            "sender_id": quoted.sender_id,
            "body": quoted.body,
            "deleted_at": quoted.deleted_at,
            "sender_name": name,
            "attachment_count": counts.get(quoted.id, 0),
        }
        for quoted, name in rows
    }

    for message in messages:
        # A quote of a message that has since expired or been hard-deleted
        # resolves to None, and the bubble renders without the quote block.
        message.quote = quotes.get(message.reply_to_id) if message.reply_to_id else None
