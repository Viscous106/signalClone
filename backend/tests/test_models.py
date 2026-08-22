import pytest
from sqlalchemy.exc import IntegrityError

from app.db.models import (
    Contact,
    Conversation,
    ConversationMember,
    Message,
    MessageReceipt,
    User,
)


def mk_user(db, phone="+15550001", name="Alice"):
    u = User(phone=phone, display_name=name)
    db.add(u)
    db.commit()
    return u


class TestUser:
    def test_created_with_defaults(self, db):
        u = mk_user(db)
        assert u.id is not None
        assert u.created_at is not None
        assert u.avatar_color  # deterministic colour assigned for initials fallback

    def test_phone_is_unique(self, db):
        mk_user(db, phone="+15550001")
        db.add(User(phone="+15550001", display_name="Impostor"))
        with pytest.raises(IntegrityError):
            db.commit()


class TestContact:
    def test_is_directional(self, db):
        """Alice having Bob must not imply Bob has Alice."""
        a, b = mk_user(db, "+1", "Alice"), mk_user(db, "+2", "Bob")
        db.add(Contact(owner_id=a.id, contact_user_id=b.id))
        db.commit()
        assert len(a.contacts) == 1
        assert len(b.contacts) == 0

    def test_cannot_add_same_contact_twice(self, db):
        a, b = mk_user(db, "+1", "Alice"), mk_user(db, "+2", "Bob")
        db.add(Contact(owner_id=a.id, contact_user_id=b.id))
        db.commit()
        db.add(Contact(owner_id=a.id, contact_user_id=b.id))
        with pytest.raises(IntegrityError):
            db.commit()


class TestConversation:
    def test_direct_and_group_share_one_table(self, db):
        a = mk_user(db)
        direct = Conversation(type="direct", created_by=a.id)
        group = Conversation(type="group", name="Weekend", created_by=a.id)
        db.add_all([direct, group])
        db.commit()
        assert direct.type == "direct" and direct.name is None
        assert group.name == "Weekend"

    def test_rejects_unknown_type(self, db):
        a = mk_user(db)
        db.add(Conversation(type="broadcast", created_by=a.id))
        with pytest.raises(IntegrityError):
            db.commit()

    def test_member_cannot_join_twice(self, db):
        a = mk_user(db)
        c = Conversation(type="group", name="G", created_by=a.id)
        db.add(c)
        db.commit()
        db.add(ConversationMember(conversation_id=c.id, user_id=a.id, role="admin"))
        db.commit()
        db.add(ConversationMember(conversation_id=c.id, user_id=a.id))
        with pytest.raises(IntegrityError):
            db.commit()

    def test_deleting_conversation_removes_messages(self, db):
        a = mk_user(db)
        c = Conversation(type="group", name="G", created_by=a.id)
        db.add(c)
        db.commit()
        db.add(Message(conversation_id=c.id, sender_id=a.id, body="hi"))
        db.commit()
        db.delete(c)
        db.commit()
        assert db.query(Message).count() == 0


class TestMessage:
    def test_system_message_has_no_sender(self, db):
        a = mk_user(db)
        c = Conversation(type="group", name="G", created_by=a.id)
        db.add(c)
        db.commit()
        m = Message(conversation_id=c.id, type="system", body="Alice created the group")
        db.add(m)
        db.commit()
        assert m.sender_id is None

    def test_soft_delete_keeps_the_row(self, db):
        from datetime import datetime, timezone

        a = mk_user(db)
        c = Conversation(type="direct", created_by=a.id)
        db.add(c)
        db.commit()
        m = Message(conversation_id=c.id, sender_id=a.id, body="oops")
        db.add(m)
        db.commit()
        m.deleted_at = datetime.now(timezone.utc)
        db.commit()
        assert db.query(Message).count() == 1


class TestMessageReceipt:
    def test_one_receipt_per_recipient(self, db):
        a, b = mk_user(db, "+1", "Alice"), mk_user(db, "+2", "Bob")
        c = Conversation(type="direct", created_by=a.id)
        db.add(c)
        db.commit()
        m = Message(conversation_id=c.id, sender_id=a.id, body="hi")
        db.add(m)
        db.commit()
        db.add(MessageReceipt(message_id=m.id, user_id=b.id))
        db.commit()
        db.add(MessageReceipt(message_id=m.id, user_id=b.id))
        with pytest.raises(IntegrityError):
            db.commit()
