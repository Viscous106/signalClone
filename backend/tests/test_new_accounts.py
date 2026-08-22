"""What a newly registered account may and may not see.

Contacts are shared so the app is usable, but chats are earned: nobody is put
into a conversation they were not invited to.
"""

from app.seed import OWNER_PHONE, seed
from tests.helpers import sign_in


class TestANewAccount:
    def test_starts_with_no_conversations(self, client, db):
        seed(db)
        me = sign_in(client, "+15551112222", "Lambda")
        assert me.get("/api/conversations").json() == []

    def test_is_never_put_into_a_group(self, client, db):
        """Only being added by an admin may join you to a group."""
        seed(db)
        me = sign_in(client, "+15551112222", "Lambda")

        groups = [c for c in me.get("/api/conversations").json() if c["type"] == "group"]
        assert groups == []

    def test_cannot_reach_the_demo_group_by_id(self, client, db):
        from app.db.models import Conversation

        seed(db)
        group = db.query(Conversation).filter_by(type="group").one()
        me = sign_in(client, "+15551112222", "Lambda")

        assert me.get(f"/api/conversations/{group.id}").status_code == 403
        assert me.get(f"/api/conversations/{group.id}/messages").status_code == 403

    def test_still_gets_the_demo_cast_as_contacts(self, client, db):
        seed(db)
        me = sign_in(client, "+15551112222", "Lambda")

        names = {c["display_name"] for c in me.get("/api/contacts").json()}
        assert {"Alice Chen", "Bob Martinez", "Carol Nwosu"} <= names

    def test_the_cast_can_see_them_back(self, client, db):
        seed(db)
        sign_in(client, "+15551112222", "Lambda")
        alice = sign_in(client, "+15550000001")

        assert "Lambda" in {c["display_name"] for c in alice.get("/api/contacts").json()}

    def test_can_start_a_chat_of_their_own(self, client, db):
        seed(db)
        me = sign_in(client, "+15551112222", "Lambda")
        alice = next(c for c in me.get("/api/contacts").json() if c["display_name"] == "Alice Chen")

        created = me.post("/api/conversations", json={"user_id": alice["id"]})
        assert created.status_code == 201
        assert len(me.get("/api/conversations").json()) == 1

    def test_two_new_accounts_see_nothing_of_each_other(self, client, db):
        seed(db)
        one = sign_in(client, "+15551112222", "Lambda")
        two = sign_in(client, "+15553334444", "Mu")

        assert one.get("/api/conversations").json() == []
        assert two.get("/api/conversations").json() == []

    def test_joining_a_group_requires_an_admin(self, client, db):
        from app.db.models import Conversation

        seed(db)
        group = db.query(Conversation).filter_by(type="group").one()
        me = sign_in(client, "+15551112222", "Lambda")
        # Alice created the group, so she is its admin. The demo owner was
        # *added* to it, which makes them a member with no such power.
        alice = sign_in(client, "+15550000001")
        owner = sign_in(client, OWNER_PHONE)

        # The newcomer cannot let themselves in...
        assert me.post(
            f"/api/conversations/{group.id}/members", json={"user_ids": [me.id]}
        ).status_code == 403

        # ...nor can a plain member...
        assert owner.post(
            f"/api/conversations/{group.id}/members", json={"user_ids": [me.id]}
        ).status_code == 403

        # ...only the admin.
        assert alice.post(
            f"/api/conversations/{group.id}/members", json={"user_ids": [me.id]}
        ).status_code == 200
        assert any(c["type"] == "group" for c in me.get("/api/conversations").json())


class TestTheDemoOwner:
    def test_exists_after_seeding(self, client, db):
        from app.db.models import User

        seed(db)
        owner = db.query(User).filter_by(phone=OWNER_PHONE).one()
        assert owner.display_name == "Yash Virulkar"

    def test_signs_in_without_being_asked_for_a_name(self, client, db):
        seed(db)
        owner = sign_in(client, OWNER_PHONE)
        assert owner.name == "Yash Virulkar"

    def test_has_the_seeded_chats(self, client, db):
        seed(db)
        owner = sign_in(client, OWNER_PHONE)

        rows = owner.get("/api/conversations").json()
        assert len([c for c in rows if c["type"] == "direct"]) >= 2
        assert len([c for c in rows if c["type"] == "group"]) == 1
        assert all(c["last_message"] for c in rows), "every seeded chat should have history"

    def test_opens_with_one_unread_badge(self, client, db):
        seed(db)
        owner = sign_in(client, OWNER_PHONE)

        badges = [c["unread_count"] for c in owner.get("/api/conversations").json()]
        assert sum(1 for n in badges if n > 0) == 1, badges

    def test_is_recreated_if_only_that_account_is_missing(self, client, db):
        """The brief: on startup, create this user if they are not there."""
        from app.db.models import User

        seed(db)
        owner = db.query(User).filter_by(phone=OWNER_PHONE).one()
        db.delete(owner)
        db.commit()
        assert db.query(User).filter_by(phone=OWNER_PHONE).first() is None

        seed(db)
        restored = db.query(User).filter_by(phone=OWNER_PHONE).one()
        assert restored.display_name == "Yash Virulkar"

    def test_seeding_twice_does_not_duplicate_their_chats(self, client, db):
        seed(db)
        owner = sign_in(client, OWNER_PHONE)
        before = len(owner.get("/api/conversations").json())

        seed(db)
        assert len(owner.get("/api/conversations").json()) == before
