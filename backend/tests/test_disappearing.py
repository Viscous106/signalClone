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


def read_up_to(actor, conv_id, message_id):
    return actor.post(f"/api/conversations/{conv_id}/read", json={"message_id": message_id})


class TestTheClockStartsOnRead:
    """A message nobody has opened has not served its purpose yet."""

    def test_sending_carries_the_duration_but_no_deadline(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 3600)
        sent = send(cast["alice"], direct["id"], "vanishing").json()

        assert sent["expire_seconds"] == 3600
        assert sent["expires_at"] is None

    def test_the_recipient_reading_it_starts_the_clock(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 3600)
        sent = send(cast["alice"], direct["id"], "vanishing").json()

        read_up_to(cast["bob"], direct["id"], sent["id"])

        messages = cast["alice"].get(f"/api/conversations/{direct['id']}/messages").json()
        [mine] = [m for m in messages if m["id"] == sent["id"]]
        assert mine["expires_at"] is not None

    def test_the_deadline_is_the_duration_after_the_read(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 3600)
        sent = send(cast["alice"], direct["id"], "vanishing").json()
        read_up_to(cast["bob"], direct["id"], sent["id"])

        messages = cast["alice"].get(f"/api/conversations/{direct['id']}/messages").json()
        [mine] = [m for m in messages if m["id"] == sent["id"]]

        # An hour from the read, not an hour from the send.
        expires = datetime.fromisoformat(mine["expires_at"])
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        assert abs((expires - datetime.now(timezone.utc)) - timedelta(hours=1)) < timedelta(seconds=5)

    def test_the_senders_own_read_does_not_start_it(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 3600)
        sent = send(cast["alice"], direct["id"], "vanishing").json()

        # Alice reading her own thread proves nothing about Bob seeing it.
        read_up_to(cast["alice"], direct["id"], sent["id"])

        messages = cast["alice"].get(f"/api/conversations/{direct['id']}/messages").json()
        [mine] = [m for m in messages if m["id"] == sent["id"]]
        assert mine["expires_at"] is None

    def test_an_unread_message_never_lapses(self, cast, direct):
        set_timer(cast["alice"], direct["id"], 30)
        send(cast["alice"], direct["id"], "unseen")

        # Well past 30 seconds of wall clock would still not remove it: the
        # clock has not started, so there is nothing to run out.
        assert "unseen" in bodies(cast["alice"], direct["id"])

    def test_reading_twice_does_not_restart_the_clock(self, cast, direct, db):
        from app.db.models import Message

        set_timer(cast["alice"], direct["id"], 3600)
        sent = send(cast["alice"], direct["id"], "vanishing").json()

        read_up_to(cast["bob"], direct["id"], sent["id"])
        db.expire_all()
        first = db.get(Message, sent["id"]).expires_at

        read_up_to(cast["bob"], direct["id"], sent["id"])
        db.expire_all()
        assert db.get(Message, sent["id"]).expires_at == first


class TestInAGroupTheLastReaderStarts:
    @pytest.fixture()
    def group(self, cast):
        return cast["alice"].post(
            "/api/conversations",
            json={"name": "Weekend Trip", "member_ids": [cast["bob"].id, cast["carol"].id]},
        ).json()

    def test_one_reader_out_of_two_is_not_enough(self, cast, group):
        set_timer(cast["alice"], group["id"], 3600)
        sent = send(cast["alice"], group["id"], "vanishing").json()

        read_up_to(cast["bob"], group["id"], sent["id"])

        messages = cast["alice"].get(f"/api/conversations/{group['id']}/messages").json()
        [mine] = [m for m in messages if m["id"] == sent["id"]]
        # Starting on the first read would delete it out from under Carol.
        assert mine["expires_at"] is None

    def test_the_last_reader_starts_it(self, cast, group):
        set_timer(cast["alice"], group["id"], 3600)
        sent = send(cast["alice"], group["id"], "vanishing").json()

        read_up_to(cast["bob"], group["id"], sent["id"])
        read_up_to(cast["carol"], group["id"], sent["id"])

        messages = cast["alice"].get(f"/api/conversations/{group['id']}/messages").json()
        [mine] = [m for m in messages if m["id"] == sent["id"]]
        assert mine["expires_at"] is not None


class TestExpiry:
    def test_a_message_sent_with_the_timer_off_has_none(self, cast, direct):
        sent = send(cast["alice"], direct["id"], "permanent").json()
        assert sent["expire_seconds"] == 0
        assert sent["expires_at"] is None

    def test_reading_a_message_with_no_timer_arms_nothing(self, cast, direct):
        sent = send(cast["alice"], direct["id"], "permanent").json()
        read_up_to(cast["bob"], direct["id"], sent["id"])

        messages = cast["alice"].get(f"/api/conversations/{direct['id']}/messages").json()
        [mine] = [m for m in messages if m["id"] == sent["id"]]
        assert mine["expires_at"] is None

    def test_changing_the_timer_does_not_touch_older_messages(self, cast, direct):
        first = send(cast["alice"], direct["id"], "before").json()
        set_timer(cast["alice"], direct["id"], 30)
        read_up_to(cast["bob"], direct["id"], first["id"])

        messages = cast["alice"].get(f"/api/conversations/{direct['id']}/messages").json()
        [before] = [m for m in messages if m["id"] == first["id"]]
        # Snapshotted at 0 when it was sent, so a later timer cannot reach back.
        assert before["expire_seconds"] == 0
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
        sent = send(cast["alice"], direct["id"], "still here").json()
        read_up_to(cast["bob"], direct["id"], sent["id"])
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
