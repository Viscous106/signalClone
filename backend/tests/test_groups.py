"""Group messaging. The message pipeline is Phase 3's, unchanged — a group is
just a conversation with more members."""

import pytest

from tests.helpers import sign_in


@pytest.fixture()
def cast(client):
    return {
        "alice": sign_in(client, "+15550000001", "Alice Chen"),
        "bob": sign_in(client, "+15550000002", "Bob Martinez"),
        "carol": sign_in(client, "+15550000003", "Carol Nwosu"),
        "dave": sign_in(client, "+15550000004", "Dave Kim"),
    }


def make_group(owner, others, name="Weekend Trip"):
    response = owner.post(
        "/api/conversations", json={"name": name, "member_ids": [o.id for o in others]}
    )
    assert response.status_code == 201, response.text
    return response.json()


def bodies(actor, conversation_id):
    return [m["body"] for m in actor.get(f"/api/conversations/{conversation_id}/messages").json()]


class TestCreatingAGroup:
    def test_creates_it_with_everyone_in(self, cast):
        group = make_group(cast["alice"], [cast["bob"], cast["carol"]])

        assert group["type"] == "group"
        assert group["name"] == "Weekend Trip"
        assert {m["display_name"] for m in group["members"]} == {
            "Alice Chen",
            "Bob Martinez",
            "Carol Nwosu",
        }

    def test_the_creator_is_the_admin(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        members = cast["alice"].get(f"/api/conversations/{group['id']}/members").json()

        admins = [m for m in members if m["role"] == "admin"]
        assert [a["user"]["display_name"] for a in admins] == ["Alice Chen"]

    def test_records_who_started_it(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        assert any("created the group" in b for b in bodies(cast["alice"], group["id"]))

    def test_needs_a_name(self, cast):
        response = cast["alice"].post(
            "/api/conversations", json={"member_ids": [cast["bob"].id]}
        )
        assert response.status_code == 400

    def test_needs_at_least_one_other_person(self, cast):
        response = cast["alice"].post("/api/conversations", json={"name": "Lonely", "member_ids": []})
        assert response.status_code == 400

    def test_rejects_an_unknown_member(self, cast):
        response = cast["alice"].post(
            "/api/conversations", json={"name": "Ghosts", "member_ids": [999999]}
        )
        assert response.status_code == 404

    def test_ignores_the_creator_appearing_in_the_member_list(self, cast):
        """Passing yourself must not create a duplicate membership row."""
        alice = cast["alice"]
        group = alice.post(
            "/api/conversations",
            json={"name": "Trip", "member_ids": [alice.id, cast["bob"].id]},
        ).json()
        assert len(group["members"]) == 2

    def test_two_groups_with_the_same_name_stay_separate(self, cast):
        """Unlike a direct chat, groups are never deduplicated."""
        first = make_group(cast["alice"], [cast["bob"]], name="Trip")
        second = make_group(cast["alice"], [cast["bob"]], name="Trip")
        assert first["id"] != second["id"]


class TestMessagingInAGroup:
    def test_everyone_sees_the_message(self, cast):
        group = make_group(cast["alice"], [cast["bob"], cast["carol"]])
        cast["bob"].post(f"/api/conversations/{group['id']}/messages", json={"body": "I vote coast"})

        for who in ("alice", "carol"):
            assert "I vote coast" in bodies(cast[who], group["id"])

    def test_outsiders_cannot_read_or_post(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        dave = cast["dave"]

        assert dave.get(f"/api/conversations/{group['id']}/messages").status_code == 403
        assert dave.post(
            f"/api/conversations/{group['id']}/messages", json={"body": "hello?"}
        ).status_code == 403

    def test_unread_counts_work_per_person(self, cast):
        group = make_group(cast["alice"], [cast["bob"], cast["carol"]])
        cast["bob"].post(f"/api/conversations/{group['id']}/messages", json={"body": "one"})
        cast["bob"].post(f"/api/conversations/{group['id']}/messages", json={"body": "two"})

        rows = {c["id"]: c for c in cast["carol"].get("/api/conversations").json()}
        assert rows[group["id"]]["unread_count"] == 2
        # Bob's own messages are not unread to Bob.
        rows = {c["id"]: c for c in cast["bob"].get("/api/conversations").json()}
        assert rows[group["id"]]["unread_count"] == 0

    def test_membership_notices_do_not_badge_the_sidebar(self, cast):
        """Being told the group exists is not an unread message."""
        group = make_group(cast["alice"], [cast["bob"], cast["carol"]])
        cast["alice"].post(
            f"/api/conversations/{group['id']}/members", json={"user_ids": [cast["dave"].id]}
        )

        rows = {c["id"]: c for c in cast["carol"].get("/api/conversations").json()}
        assert rows[group["id"]]["unread_count"] == 0
        # ...but the notice is still the preview, so the change is visible.
        assert "added" in rows[group["id"]]["last_message"]["body"]

    def test_a_message_stays_undelivered_until_everyone_has_it(self, cast):
        """Signal's rule: one absent member keeps the ticks at 'sent'."""
        group = make_group(cast["alice"], [cast["bob"], cast["carol"]])

        sent = cast["alice"].post(
            f"/api/conversations/{group['id']}/messages", json={"body": "everyone here?"}
        ).json()
        assert sent["status"] == "sent"

        # Only Bob reads it — Carol has not.
        cast["bob"].post(f"/api/conversations/{group['id']}/read", json={"message_id": sent["id"]})
        rows = cast["alice"].get(f"/api/conversations/{group['id']}/messages").json()
        assert rows[0]["status"] == "sent"

        cast["carol"].post(f"/api/conversations/{group['id']}/read", json={"message_id": sent["id"]})
        rows = cast["alice"].get(f"/api/conversations/{group['id']}/messages").json()
        assert rows[0]["status"] == "read"


class TestMembers:
    def test_admin_can_add_someone(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        response = cast["alice"].post(
            f"/api/conversations/{group['id']}/members", json={"user_ids": [cast["carol"].id]}
        )
        assert response.status_code == 200

        members = cast["alice"].get(f"/api/conversations/{group['id']}/members").json()
        assert {m["user"]["display_name"] for m in members} == {
            "Alice Chen",
            "Bob Martinez",
            "Carol Nwosu",
        }

    def test_adding_writes_a_notice_into_the_thread(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        cast["alice"].post(
            f"/api/conversations/{group['id']}/members", json={"user_ids": [cast["carol"].id]}
        )
        assert any("added Carol Nwosu" in b for b in bodies(cast["alice"], group["id"]))

    def test_a_new_member_can_read_the_history(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        cast["alice"].post(f"/api/conversations/{group['id']}/messages", json={"body": "before"})
        cast["alice"].post(
            f"/api/conversations/{group['id']}/members", json={"user_ids": [cast["carol"].id]}
        )
        assert "before" in bodies(cast["carol"], group["id"])

    def test_a_plain_member_cannot_add_anyone(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        response = cast["bob"].post(
            f"/api/conversations/{group['id']}/members", json={"user_ids": [cast["carol"].id]}
        )
        assert response.status_code == 403

    def test_adding_an_existing_member_changes_nothing(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        cast["alice"].post(
            f"/api/conversations/{group['id']}/members", json={"user_ids": [cast["bob"].id]}
        )
        members = cast["alice"].get(f"/api/conversations/{group['id']}/members").json()
        assert len(members) == 2

    def test_admin_can_remove_someone(self, cast):
        group = make_group(cast["alice"], [cast["bob"], cast["carol"]])
        response = cast["alice"].delete(
            f"/api/conversations/{group['id']}/members/{cast['carol'].id}"
        )
        assert response.status_code == 200
        assert any("removed Carol Nwosu" in b for b in bodies(cast["alice"], group["id"]))

    def test_a_removed_member_loses_access(self, cast):
        group = make_group(cast["alice"], [cast["bob"], cast["carol"]])
        cast["alice"].delete(f"/api/conversations/{group['id']}/members/{cast['carol'].id}")

        assert cast["carol"].get(f"/api/conversations/{group['id']}/messages").status_code == 403
        assert group["id"] not in {c["id"] for c in cast["carol"].get("/api/conversations").json()}

    def test_a_plain_member_cannot_remove_others(self, cast):
        group = make_group(cast["alice"], [cast["bob"], cast["carol"]])
        response = cast["bob"].delete(
            f"/api/conversations/{group['id']}/members/{cast['carol'].id}"
        )
        assert response.status_code == 403

    def test_anyone_can_leave(self, cast):
        group = make_group(cast["alice"], [cast["bob"], cast["carol"]])
        response = cast["bob"].delete(f"/api/conversations/{group['id']}/members/{cast['bob'].id}")
        assert response.status_code == 200
        assert any("left the group" in b for b in bodies(cast["alice"], group["id"]))

    def test_removing_a_non_member_is_404(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        assert cast["alice"].delete(
            f"/api/conversations/{group['id']}/members/{cast['dave'].id}"
        ).status_code == 404

    def test_the_last_admin_leaving_hands_over_the_keys(self, cast):
        """A group with no admin can never be administered again."""
        group = make_group(cast["alice"], [cast["bob"], cast["carol"]])
        cast["alice"].delete(f"/api/conversations/{group['id']}/members/{cast['alice'].id}")

        members = cast["bob"].get(f"/api/conversations/{group['id']}/members").json()
        admins = [m for m in members if m["role"] == "admin"]
        assert len(admins) == 1, "somebody must still be able to administer the group"

    def test_members_endpoint_is_members_only(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        assert cast["dave"].get(f"/api/conversations/{group['id']}/members").status_code == 403


class TestRenaming:
    def test_admin_can_rename(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        response = cast["alice"].patch(
            f"/api/conversations/{group['id']}", json={"name": "Coast Trip"}
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Coast Trip"
        assert any("Coast Trip" in b for b in bodies(cast["alice"], group["id"]))

    def test_a_plain_member_cannot_rename(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        assert cast["bob"].patch(
            f"/api/conversations/{group['id']}", json={"name": "Hijacked"}
        ).status_code == 403

    def test_a_direct_chat_cannot_be_renamed(self, cast):
        direct = cast["alice"].post(
            "/api/conversations", json={"user_id": cast["bob"].id}
        ).json()
        assert cast["alice"].patch(
            f"/api/conversations/{direct['id']}", json={"name": "Nope"}
        ).status_code == 400

    def test_rejects_a_blank_name(self, cast):
        group = make_group(cast["alice"], [cast["bob"]])
        assert cast["alice"].patch(
            f"/api/conversations/{group['id']}", json={"name": "   "}
        ).status_code == 422
