from app.db.models import Conversation, ConversationMember, Message, User
from app.seed import seed


class TestSeed:
    def test_populates_a_usable_app(self, db):
        seed(db)
        users = db.query(User).all()
        assert len(users) == 5
        # Sidebar is useless without both kinds of conversation.
        assert db.query(Conversation).filter_by(type="direct").count() == 2
        assert db.query(Conversation).filter_by(type="group").count() == 1
        assert db.query(Message).count() >= 15

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


class TestApp:
    def test_health_endpoint(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_unknown_route_is_404(self, client):
        assert client.get("/api/nope").status_code == 404
