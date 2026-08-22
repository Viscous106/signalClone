from app.db.models import Conversation, ConversationMember, Message, User
from app.seed import seed


class TestSeed:
    def test_populates_a_usable_app(self, db):
        from app.seed import OWNER_PHONE

        seed(db)
        # Five demo users plus the designated owner.
        assert db.query(User).count() == 6
        assert db.query(User).filter_by(phone=OWNER_PHONE).count() == 1
        # Sidebar is useless without both kinds of conversation.
        assert db.query(Conversation).filter_by(type="direct").count() == 4
        assert db.query(Conversation).filter_by(type="group").count() == 1
        assert db.query(Message).count() >= 20

    def test_is_idempotent(self, db):
        """Runs on every boot, so a second run must not duplicate anything."""
        seed(db)
        counts = (db.query(User).count(), db.query(Conversation).count(), db.query(Message).count())
        seed(db)
        assert (db.query(User).count(), db.query(Conversation).count(), db.query(Message).count()) == counts

    def test_group_has_exactly_one_admin(self, db):
        seed(db)
        group = db.query(Conversation).filter_by(type="group").one()
        admins = [m for m in group.members if m.role == "admin"]
        assert len(admins) == 1
        assert len(group.members) >= 3

    def test_messages_are_ordered_and_conversations_sorted(self, db):
        seed(db)
        for conv in db.query(Conversation).all():
            times = [m.created_at for m in conv.messages]
            assert times == sorted(times), "seeded messages must read chronologically"
            assert conv.last_message_at == max(times), "sidebar sort key must match newest message"


    def test_leaves_a_realistic_mix_of_read_and_unread(self, db):
        """A seed where every chat is unread looks broken rather than lived-in."""
        from app.db.models import ConversationMember, Message, User

        seed(db)
        alice = db.query(User).filter_by(username="alice").one()

        badges = {}
        for member in db.query(ConversationMember).filter_by(user_id=alice.id).all():
            badges[member.conversation_id] = (
                db.query(Message)
                .filter(
                    Message.conversation_id == member.conversation_id,
                    Message.id > member.last_read_message_id,
                    Message.sender_id != alice.id,
                )
                .count()
            )

        assert any(count > 0 for count in badges.values()), "nothing unread — no badges to show"
        assert any(count == 0 for count in badges.values()), "everything unread — looks broken"


class TestApp:
    def test_health_endpoint(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_unknown_route_is_404(self, client):
        assert client.get("/api/nope").status_code == 404
