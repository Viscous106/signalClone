"""What a newly registered account is given.

The demo cast as contacts, so the app is usable and searchable — and nothing
else. Conversations are earned: being in a chat means somebody started one with
you, and being in a group means an admin added you. Handing out fabricated
history, or a group membership nobody granted, is wrong on both counts.
"""

from sqlalchemy.orm import Session

from app.db.models import Contact, User

DEMO_USERNAMES = ["alice", "bob", "carol", "dave", "erin"]


def add_demo_contacts(db: Session, me: User) -> list[User]:
    """Introduce a new account to the demo cast. Returns who was added."""
    cast = (
        db.query(User)
        .filter(User.username.in_(DEMO_USERNAMES), User.id != me.id)
        .all()
    )
    if not cast:
        return []  # nothing seeded to introduce them to

    for user in cast:
        db.add(Contact(owner_id=me.id, contact_user_id=user.id))
        # Directional, so the cast needs the reverse entry to find them back.
        db.add(Contact(owner_id=user.id, contact_user_id=me.id))
    db.commit()
    return cast
