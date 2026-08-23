"""Emoji reactions.

One reaction per person per message: reacting again replaces, and reacting with
the same emoji twice clears it. That toggle is the whole interaction, so it
lives in one function rather than split across add and remove routes.
"""

from sqlalchemy.orm import Session

from app.db.models import Message, MessageReaction, User

# Signal's tray, in its order. A closed set keeps the pills a predictable
# width and stops arbitrary text being stored as an "emoji".
ALLOWED = ["👍", "❤️", "😂", "😮", "😢", "🙏"]


def is_allowed(emoji: str) -> bool:
    return emoji in ALLOWED


def toggle(db: Session, message: Message, user: User, emoji: str) -> None:
    """Set, replace, or clear this user's reaction. Blank emoji always clears."""
    existing = (
        db.query(MessageReaction)
        .filter_by(message_id=message.id, user_id=user.id)
        .first()
    )

    if not emoji:
        if existing:
            db.delete(existing)
        db.commit()
        return

    if existing is None:
        db.add(MessageReaction(message_id=message.id, user_id=user.id, emoji=emoji))
    elif existing.emoji == emoji:
        # Tapping the pill you are already in removes you from it.
        db.delete(existing)
    else:
        existing.emoji = emoji
    db.commit()


def grouped_for(db: Session, messages: list[Message], viewer_id: int) -> dict[int, list[dict]]:
    """Reactions per message, grouped by emoji. One query for the whole page."""
    if not messages:
        return {}

    rows = (
        db.query(MessageReaction, User.display_name)
        .join(User, User.id == MessageReaction.user_id)
        .filter(MessageReaction.message_id.in_([m.id for m in messages]))
        .order_by(MessageReaction.id)
        .all()
    )

    # message_id -> emoji -> {names, mine}. Insertion order is first-reacted
    # first, which is the order Signal shows the pills in.
    by_message: dict[int, dict[str, dict]] = {}
    for reaction, display_name in rows:
        group = by_message.setdefault(reaction.message_id, {}).setdefault(
            reaction.emoji, {"names": [], "mine": False}
        )
        group["names"].append(display_name)
        if reaction.user_id == viewer_id:
            group["mine"] = True

    return {
        message_id: [
            {"emoji": emoji, "count": len(g["names"]), "names": g["names"], "mine": g["mine"]}
            for emoji, g in emojis.items()
        ]
        for message_id, emojis in by_message.items()
    }


def attach(db: Session, messages: list[Message], viewer_id: int) -> None:
    grouped = grouped_for(db, messages, viewer_id)
    for message in messages:
        # A plain attribute, deliberately not the `reactions` relationship:
        # assigning dicts to a mapped collection makes the next flush fail.
        message.reaction_pills = grouped.get(message.id, [])
