"""Disappearing messages. The timer belongs to the conversation, not the sender."""

from datetime import datetime, timedelta, timezone

import pytest

from tests.helpers import sign_in


@pytest.fixture()
def cast(client):
    return {
        "alice": sign_in(client, "+15550000001", "Alice Chen"),
        "bob": sign_in(client, "+15550000002", "Bob Martinez"),
        "carol": sign_in(client, "+15550000003", "Carol Nwosu"),
    }


@pytest.fixture()
def direct(cast):
    return cast["alice"].post("/api/conversations", json={"user_id": cast["bob"].id}).json()


def set_timer(actor, conv_id, seconds):
    return actor.patch(f"/api/conversations/{conv_id}/disappearing", json={"seconds": seconds})


def send(actor, conv_id, body):
    return actor.post(f"/api/conversations/{conv_id}/messages", json={"body": body})


def bodies(actor, conv_id):
    return [m["body"] for m in actor.get(f"/api/conversations/{conv_id}/messages").json()]


class TestSettingTheTimer:
    def test_it_starts_off(self, direct):
        assert direct["disappear_seconds"] == 0

    def test_a_member_can_set_it_in_a_direct_chat(self, cast, direct):
        response = set_timer(cast["alice"], direct["id"], 3600)
        assert response.status_code == 200
        assert response.json()["disappear_seconds"] == 3600

    def test_the_change_announces_itself_in_the_thread(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 3600)
        # Nobody should have a message quietly given a lifetime by someone else.
        assert any("set disappearing messages to 1 hour" in b for b in bodies(cast["bob"], direct["id"]))

    def test_turning_it_off_says_so(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 3600)
        set_timer(cast["alice"], direct["id"], 0)
        assert any("turned off disappearing messages" in b for b in bodies(cast["bob"], direct["id"]))

    def test_both_sides_see_the_same_timer(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 300)
        mine = cast["bob"].get(f"/api/conversations/{direct['id']}").json()
        assert mine["disappear_seconds"] == 300

    def test_setting_the_same_value_announces_nothing(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 300)
        before = len(bodies(cast["alice"], direct["id"]))
        set_timer(cast["alice"], direct["id"], 300)
        assert len(bodies(cast["alice"], direct["id"])) == before

    def test_an_unsupported_duration_is_refused(self, cast, direct):
        assert set_timer(cast["alice"], direct["id"], 47).status_code == 400

    def test_a_non_member_cannot_set_it(self, cast, direct):
        outsider = sign_in(cast["alice"].client, "+15550000009", "Dave Kim")
        assert set_timer(outsider, direct["id"], 300).status_code == 403


class TestInAGroup:
    @pytest.fixture()
    def group(self, cast):
        return cast["alice"].post(
            "/api/conversations",
            json={"name": "Weekend Trip", "member_ids": [cast["bob"].id, cast["carol"].id]},
        ).json()

    def test_an_admin_can_set_it(self, cast, group):
        assert set_timer(cast["alice"], group["id"], 3600).status_code == 200

    def test_a_plain_member_cannot(self, cast, group):
        # Same rule as renaming: a group-wide setting is an admin action.
        assert set_timer(cast["bob"], group["id"], 3600).status_code == 403


class TestExpiry:
    def test_a_message_sent_under_a_timer_gets_a_deadline(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 3600)
        sent = send(cast["alice"], direct["id"], "vanishing").json()
        assert sent["expires_at"] is not None

    def test_a_message_sent_with_the_timer_off_has_none(self, cast, direct):
        assert send(cast["alice"], direct["id"], "permanent").json()["expires_at"] is None

    def test_the_deadline_matches_the_timer(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 3600)
        sent = send(cast["alice"], direct["id"], "vanishing").json()

        created = datetime.fromisoformat(sent["created_at"])
        expires = datetime.fromisoformat(sent["expires_at"])
        assert abs((expires - created) - timedelta(hours=1)) < timedelta(seconds=2)

    def test_changing_the_timer_does_not_touch_older_messages(self, cast, direct):
        first = send(cast["alice"], direct["id"], "before").json()
        set_timer(cast["alice"], direct["id"], 30)

        messages = cast["alice"].get(f"/api/conversations/{direct['id']}/messages").json()
        [before] = [m for m in messages if m["id"] == first["id"]]
        assert before["expires_at"] is None

    def test_a_lapsed_message_is_hidden(self, cast, direct, db):
        from app.db.models import Message

        set_timer(cast["alice"], direct["id"], 30)
        sent = send(cast["alice"], direct["id"], "gone by now").json()

        db.get(Message, sent["id"]).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()

        assert "gone by now" not in bodies(cast["alice"], direct["id"])

    def test_it_is_hidden_from_everyone_not_just_the_sender(self, cast, direct, db):
        from app.db.models import Message

        set_timer(cast["alice"], direct["id"], 30)
        sent = send(cast["alice"], direct["id"], "gone by now").json()

        db.get(Message, sent["id"]).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()

        assert "gone by now" not in bodies(cast["bob"], direct["id"])

    def test_reading_the_thread_reclaims_the_row(self, cast, direct, db):
        from app.db.models import Message

        set_timer(cast["alice"], direct["id"], 30)
        sent = send(cast["alice"], direct["id"], "gone by now").json()

        db.get(Message, sent["id"]).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()

        cast["alice"].get(f"/api/conversations/{direct['id']}/messages")
        db.expire_all()
        assert db.get(Message, sent["id"]) is None

    def test_a_message_still_in_date_stays(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 3600)
        send(cast["alice"], direct["id"], "still here")
        assert "still here" in bodies(cast["alice"], direct["id"])

    def test_expiring_takes_the_attachments_with_it(self, cast, direct, db):
        import base64

        from app.db.models import Attachment, Message

        set_timer(cast["alice"], direct["id"], 30)
        png = "data:image/png;base64," + base64.b64encode(b"png").decode()
        sent = cast["alice"].post(
            f"/api/conversations/{direct['id']}/messages",
            json={"body": "", "attachments": [{"name": "a.png", "mime": "image/png", "data_url": png}]},
        ).json()

        db.get(Message, sent["id"]).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()

        cast["alice"].get(f"/api/conversations/{direct['id']}/messages")
        db.expire_all()
        assert db.query(Attachment).count() == 0
