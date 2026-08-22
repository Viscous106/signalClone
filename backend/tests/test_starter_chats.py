"""A brand-new account should land in a populated app.

Seeding only Alice's chats means the app looks broken to anyone who registers
with their own number — which is exactly what a reviewer does first.
"""

from app.seed import seed
from tests.helpers import sign_in


class TestNewAccount:
    def test_lands_in_a_populated_app(self, client, db):
        seed(db)
        me = sign_in(client, "+919834758028", "Yash Virulkar")

        rows = me.get("/api/conversations").json()
        assert len(rows) >= 3, "a new account should have something to look at"

    def test_gets_the_demo_cast_as_contacts(self, client, db):
        seed(db)
        me = sign_in(client, "+919834758028", "Yash Virulkar")

        names = {c["display_name"] for c in me.get("/api/contacts").json()}
        assert {"Alice Chen", "Bob Martinez", "Carol Nwosu"} <= names

    def test_the_demo_cast_can_find_me_back(self, client, db):
        """Contacts are directional, so both sides need the entry."""
        seed(db)
        me = sign_in(client, "+919834758028", "Yash Virulkar")
        alice = sign_in(client, "+15550000001")

        assert "Yash Virulkar" in {c["display_name"] for c in alice.get("/api/contacts").json()}

    def test_has_history_to_read_not_just_empty_threads(self, client, db):
        seed(db)
        me = sign_in(client, "+919834758028", "Yash Virulkar")

        rows = me.get("/api/conversations").json()
        with_messages = [r for r in rows if r["last_message"] is not None]
        assert len(with_messages) >= 3

    def test_someone_else_wrote_some_of_it(self, client, db):
        """A thread of only my own messages is not a conversation."""
        seed(db)
        me = sign_in(client, "+919834758028", "Yash Virulkar")

        direct = next(r for r in me.get("/api/conversations").json() if r["type"] == "direct")
        senders = {
            m["sender_id"]
            for m in me.get(f"/api/conversations/{direct['id']}/messages").json()
        }
        assert senders - {me.id}, "the other person should have said something"

    def test_opens_with_exactly_one_unread_badge(self, client, db):
        seed(db)
        me = sign_in(client, "+919834758028", "Yash Virulkar")

        badges = [r["unread_count"] for r in me.get("/api/conversations").json()]
        assert sum(1 for n in badges if n > 0) == 1, badges

    def test_is_in_the_group_chat(self, client, db):
        seed(db)
        me = sign_in(client, "+919834758028", "Yash Virulkar")

        groups = [r for r in me.get("/api/conversations").json() if r["type"] == "group"]
        assert len(groups) == 1
        assert len(groups[0]["members"]) >= 4

    def test_can_reply_straight_away(self, client, db):
        seed(db)
        me = sign_in(client, "+919834758028", "Yash Virulkar")

        conversation = me.get("/api/conversations").json()[0]
        sent = me.post(
            f"/api/conversations/{conversation['id']}/messages", json={"body": "hello there"}
        )
        assert sent.status_code == 201


class TestItRunsOnce:
    def test_signing_in_again_adds_nothing(self, client, db):
        seed(db)
        me = sign_in(client, "+919834758028", "Yash Virulkar")
        before = len(me.get("/api/conversations").json())

        me.post("/api/auth/logout")
        again = sign_in(client, "+919834758028")
        assert len(again.get("/api/conversations").json()) == before

    def test_two_new_accounts_do_not_share_chats(self, client, db):
        seed(db)
        one = sign_in(client, "+919834758028", "Yash Virulkar")
        two = sign_in(client, "+919999999999", "Someone Else")

        ids_one = {r["id"] for r in one.get("/api/conversations").json()}
        ids_two = {r["id"] for r in two.get("/api/conversations").json()}
        # The group is shared; the direct chats must not be.
        directs_one = {r["id"] for r in one.get("/api/conversations").json() if r["type"] == "direct"}
        directs_two = {r["id"] for r in two.get("/api/conversations").json() if r["type"] == "direct"}
        assert directs_one.isdisjoint(directs_two)
        assert ids_one & ids_two, "both should be in the shared group"


class TestWithoutSeedData:
    def test_registration_still_works_on_an_empty_database(self, client):
        """No demo cast to befriend — this must not explode."""
        me = sign_in(client, "+919834758028", "Yash Virulkar")
        assert me.get("/api/conversations").json() == []
        assert me.get("/api/contacts").json() == []
