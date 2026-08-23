"""Reactions are a toggle: one emoji per person per message."""

import pytest

from tests.helpers import sign_in

THUMB = "\U0001f44d"
HEART = "❤️"


@pytest.fixture()
def cast(client):
    return {
        "alice": sign_in(client, "+15550000001", "Alice Chen"),
        "bob": sign_in(client, "+15550000002", "Bob Martinez"),
        "carol": sign_in(client, "+15550000003", "Carol Nwosu"),
    }


@pytest.fixture()
def thread(cast):
    group = cast["alice"].post(
        "/api/conversations",
        json={"name": "Weekend Trip", "member_ids": [cast["bob"].id, cast["carol"].id]},
    ).json()
    message = cast["alice"].post(
        f"/api/conversations/{group['id']}/messages", json={"body": "I vote coast"}
    ).json()
    return group, message


def react(actor, conv_id, message_id, emoji):
    return actor.post(
        f"/api/conversations/{conv_id}/messages/{message_id}/reactions", json={"emoji": emoji}
    )


def pills(actor, conv_id, message_id):
    messages = actor.get(f"/api/conversations/{conv_id}/messages").json()
    [message] = [m for m in messages if m["id"] == message_id]
    return message["reactions"]


class TestReacting:
    def test_a_reaction_shows_as_a_pill_with_a_count(self, cast, thread):
        group, message = thread
        response = react(cast["bob"], group["id"], message["id"], THUMB)
        assert response.status_code == 200

        [pill] = response.json()["reactions"]
        assert (pill["emoji"], pill["count"]) == (THUMB, 1)
        assert pill["names"] == ["Bob Martinez"]

    def test_two_people_on_the_same_emoji_share_one_pill(self, cast, thread):
        group, message = thread
        react(cast["bob"], group["id"], message["id"], THUMB)
        react(cast["carol"], group["id"], message["id"], THUMB)

        [pill] = pills(cast["alice"], group["id"], message["id"])
        assert pill["count"] == 2
        assert set(pill["names"]) == {"Bob Martinez", "Carol Nwosu"}

    def test_different_emoji_get_their_own_pills(self, cast, thread):
        group, message = thread
        react(cast["bob"], group["id"], message["id"], THUMB)
        react(cast["carol"], group["id"], message["id"], HEART)

        assert {p["emoji"] for p in pills(cast["alice"], group["id"], message["id"])} == {THUMB, HEART}

    def test_mine_is_true_only_for_the_person_who_reacted(self, cast, thread):
        group, message = thread
        react(cast["bob"], group["id"], message["id"], THUMB)

        assert pills(cast["bob"], group["id"], message["id"])[0]["mine"] is True
        assert pills(cast["carol"], group["id"], message["id"])[0]["mine"] is False

    def test_you_can_react_to_your_own_message(self, cast, thread):
        group, message = thread
        assert react(cast["alice"], group["id"], message["id"], THUMB).status_code == 200

    def test_a_reaction_survives_a_reload(self, cast, thread):
        group, message = thread
        react(cast["bob"], group["id"], message["id"], THUMB)
        assert len(pills(cast["bob"], group["id"], message["id"])) == 1


class TestTheToggle:
    def test_the_same_emoji_twice_removes_it(self, cast, thread):
        group, message = thread
        react(cast["bob"], group["id"], message["id"], THUMB)
        response = react(cast["bob"], group["id"], message["id"], THUMB)
        assert response.json()["reactions"] == []

    def test_a_different_emoji_replaces_rather_than_adds(self, cast, thread):
        group, message = thread
        react(cast["bob"], group["id"], message["id"], THUMB)
        response = react(cast["bob"], group["id"], message["id"], HEART)

        # One person holds one reaction, so the thumb is gone, not tallied.
        [pill] = response.json()["reactions"]
        assert pill["emoji"] == HEART

    def test_a_blank_emoji_clears_it(self, cast, thread):
        group, message = thread
        react(cast["bob"], group["id"], message["id"], THUMB)
        assert react(cast["bob"], group["id"], message["id"], "").json()["reactions"] == []

    def test_clearing_nothing_is_not_an_error(self, cast, thread):
        group, message = thread
        assert react(cast["bob"], group["id"], message["id"], "").status_code == 200

    def test_removing_mine_leaves_everyone_elses(self, cast, thread):
        group, message = thread
        react(cast["bob"], group["id"], message["id"], THUMB)
        react(cast["carol"], group["id"], message["id"], THUMB)
        react(cast["bob"], group["id"], message["id"], THUMB)

        [pill] = pills(cast["alice"], group["id"], message["id"])
        assert (pill["count"], pill["names"]) == (1, ["Carol Nwosu"])


class TestWhatIsRefused:
    def test_an_emoji_outside_the_tray(self, cast, thread):
        group, message = thread
        assert react(cast["bob"], group["id"], message["id"], "\U0001f4a9").status_code == 400

    def test_arbitrary_text_is_not_an_emoji(self, cast, thread):
        group, message = thread
        assert react(cast["bob"], group["id"], message["id"], "lgtm").status_code == 400

    def test_a_non_member(self, cast, thread):
        group, message = thread
        outsider = sign_in(cast["alice"].client, "+15550000009", "Dave Kim")
        assert react(outsider, group["id"], message["id"], THUMB).status_code == 403

    def test_a_message_from_another_conversation(self, cast, thread):
        group, message = thread
        other = cast["alice"].post("/api/conversations", json={"user_id": cast["bob"].id}).json()
        assert react(cast["alice"], other["id"], message["id"], THUMB).status_code == 404

    def test_a_message_that_does_not_exist(self, cast, thread):
        group, _ = thread
        assert react(cast["bob"], group["id"], 9999, THUMB).status_code == 404


class TestCleanup:
    def test_deleting_a_message_takes_its_reactions(self, cast, thread, db):
        from app.db.models import Message, MessageReaction

        group, message = thread
        react(cast["bob"], group["id"], message["id"], THUMB)

        db.delete(db.get(Message, message["id"]))
        db.commit()
        assert db.query(MessageReaction).count() == 0
