"""Quoted replies. The quote is a flat snippet, never a nested message."""

import base64

import pytest

from tests.helpers import sign_in


@pytest.fixture()
def cast(client):
    return {
        "alice": sign_in(client, "+15550000001", "Alice Chen"),
        "bob": sign_in(client, "+15550000002", "Bob Martinez"),
    }


@pytest.fixture()
def thread(cast):
    conv = cast["alice"].post("/api/conversations", json={"user_id": cast["bob"].id}).json()
    original = cast["alice"].post(
        f"/api/conversations/{conv['id']}/messages", json={"body": "Where are we going?"}
    ).json()
    return conv, original


def reply(actor, conv_id, body, to_id):
    return actor.post(
        f"/api/conversations/{conv_id}/messages", json={"body": body, "reply_to_id": to_id}
    )


class TestQuoting:
    def test_a_reply_carries_the_quoted_snippet(self, cast, thread):
        conv, original = thread
        response = reply(cast["bob"], conv["id"], "The coast", original["id"])
        assert response.status_code == 201

        quote = response.json()["quote"]
        assert quote["body"] == "Where are we going?"
        assert quote["sender_name"] == "Alice Chen"
        assert quote["id"] == original["id"]

    def test_a_plain_message_has_no_quote(self, cast, thread):
        conv, _ = thread
        response = cast["bob"].post(f"/api/conversations/{conv['id']}/messages", json={"body": "hi"})
        assert response.json()["quote"] is None

    def test_the_quote_survives_a_reload(self, cast, thread):
        conv, original = thread
        reply(cast["bob"], conv["id"], "The coast", original["id"])

        messages = cast["alice"].get(f"/api/conversations/{conv['id']}/messages").json()
        assert messages[0]["quote"]["body"] == "Where are we going?"

    def test_you_can_reply_to_your_own_message(self, cast, thread):
        conv, original = thread
        assert reply(cast["alice"], conv["id"], "Actually…", original["id"]).status_code == 201

    def test_a_quote_of_an_image_reports_its_attachment_count(self, cast, thread):
        conv, _ = thread
        png = "data:image/png;base64," + base64.b64encode(b"png").decode()
        image = cast["alice"].post(
            f"/api/conversations/{conv['id']}/messages",
            json={"body": "", "attachments": [{"name": "a.png", "mime": "image/png", "data_url": png}]},
        ).json()

        # An empty body would otherwise render as an empty quote block.
        assert reply(cast["bob"], conv["id"], "nice", image["id"]).json()["quote"]["attachment_count"] == 1

    def test_a_reply_to_a_reply_does_not_nest(self, cast, thread):
        conv, original = thread
        first = reply(cast["bob"], conv["id"], "The coast", original["id"]).json()
        second = reply(cast["alice"], conv["id"], "Agreed", first["id"]).json()

        # The quote is flat: it shows the message it answers, not that
        # message's own quote.
        assert second["quote"]["body"] == "The coast"
        assert "quote" not in second["quote"]

    def test_a_deleted_original_still_quotes_but_is_marked(self, cast, thread, db):
        from datetime import datetime, timezone

        from app.db.models import Message

        conv, original = thread
        reply(cast["bob"], conv["id"], "The coast", original["id"])

        db.get(Message, original["id"]).deleted_at = datetime.now(timezone.utc)
        db.commit()

        messages = cast["alice"].get(f"/api/conversations/{conv['id']}/messages").json()
        assert messages[0]["quote"]["deleted_at"] is not None


class TestWhatIsRefused:
    def test_quoting_a_message_from_another_conversation(self, cast, thread):
        conv, original = thread
        other = cast["alice"].post(
            "/api/conversations", json={"name": "Group", "member_ids": [cast["bob"].id]}
        ).json()

        # Otherwise a message leaks into a thread its members were never in.
        assert reply(cast["alice"], other["id"], "leak", original["id"]).status_code == 400

    def test_quoting_a_message_that_does_not_exist(self, cast, thread):
        conv, _ = thread
        assert reply(cast["alice"], conv["id"], "hi", 9999).status_code == 400

    def test_a_rejected_reply_writes_nothing(self, cast, thread):
        conv, _ = thread
        before = len(cast["alice"].get(f"/api/conversations/{conv['id']}/messages").json())
        reply(cast["alice"], conv["id"], "hi", 9999)
        after = len(cast["alice"].get(f"/api/conversations/{conv['id']}/messages").json())
        assert before == after


class TestWhenTheOriginalIsGone:
    def test_a_hard_deleted_original_leaves_the_reply_standing(self, cast, thread, db):
        from app.db.models import Message

        conv, original = thread
        posted = reply(cast["bob"], conv["id"], "The coast", original["id"]).json()

        db.delete(db.get(Message, original["id"]))
        db.commit()

        messages = cast["alice"].get(f"/api/conversations/{conv['id']}/messages").json()
        [surviving] = [m for m in messages if m["id"] == posted["id"]]
        # SET NULL on the FK, so the reply renders without a quote block.
        assert surviving["quote"] is None
        assert surviving["body"] == "The coast"
