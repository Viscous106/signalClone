import pytest


@pytest.fixture()
def cast(make_user):
    """Alice plus three others to talk to."""
    return {
        "bob": make_user("+15550000002", "Bob Martinez"),
        "carol": make_user("+15550000003", "Carol Nwosu"),
        "dave": make_user("+15550000004", "Dave Kim"),
    }


def start_direct(client, user_id: int):
    response = client.post("/api/conversations", json={"user_id": user_id})
    assert response.status_code in (200, 201), response.text
    return response.json()


def send(client, conv_id: int, body: str):
    response = client.post(f"/api/conversations/{conv_id}/messages", json={"body": body})
    assert response.status_code == 201, response.text
    return response.json()


class TestStartingADirectChat:
    def test_creates_a_conversation_with_both_members(self, client, login, cast):
        login("+15550000001", "Alice")
        conv = start_direct(client, cast["bob"].id)

        assert conv["type"] == "direct"
        assert conv["name"] is None
        assert {m["display_name"] for m in conv["members"]} == {"Alice", "Bob Martinez"}

    def test_asking_twice_returns_the_same_conversation(self, client, login, cast):
        """Otherwise the sidebar fills with duplicate chats for one person."""
        login("+15550000001", "Alice")
        first = start_direct(client, cast["bob"].id)
        second = start_direct(client, cast["bob"].id)
        assert first["id"] == second["id"]
        assert len(client.get("/api/conversations").json()) == 1

    def test_cannot_start_a_chat_with_yourself(self, client, login):
        me = login("+15550000001", "Alice")
        assert client.post("/api/conversations", json={"user_id": me["id"]}).status_code == 400

    def test_unknown_user_is_404(self, client, login):
        login("+15550000001", "Alice")
        assert client.post("/api/conversations", json={"user_id": 9999}).status_code == 404


class TestTheConversationList:
    def test_is_empty_for_a_new_account(self, client, login):
        login("+15550000001", "Alice")
        assert client.get("/api/conversations").json() == []

    def test_shows_only_conversations_i_am_in(self, client, login, cast, db):
        from app.db.models import Conversation, ConversationMember

        other = Conversation(type="direct", created_by=cast["bob"].id)
        db.add(other)
        db.commit()
        db.add_all([
            ConversationMember(conversation_id=other.id, user_id=cast["bob"].id),
            ConversationMember(conversation_id=other.id, user_id=cast["carol"].id),
        ])
        db.commit()

        login("+15550000001", "Alice")
        assert client.get("/api/conversations").json() == []

    def test_sorted_by_most_recent_activity(self, client, login, cast):
        login("+15550000001", "Alice")
        with_bob = start_direct(client, cast["bob"].id)
        with_carol = start_direct(client, cast["carol"].id)

        send(client, with_bob["id"], "first")
        send(client, with_carol["id"], "second")
        send(client, with_bob["id"], "third — bob is newest again")

        order = [c["id"] for c in client.get("/api/conversations").json()]
        assert order == [with_bob["id"], with_carol["id"]]

    def test_carries_the_last_message_for_the_preview(self, client, login, cast):
        login("+15550000001", "Alice")
        conv = start_direct(client, cast["bob"].id)
        send(client, conv["id"], "older")
        send(client, conv["id"], "the newest one")

        row = client.get("/api/conversations").json()[0]
        assert row["last_message"]["body"] == "the newest one"

    def test_a_conversation_with_no_messages_has_no_preview(self, client, login, cast):
        login("+15550000001", "Alice")
        start_direct(client, cast["bob"].id)
        row = client.get("/api/conversations").json()[0]
        assert row["last_message"] is None
        assert row["unread_count"] == 0

    def test_does_not_go_n_plus_1(self, client, login, cast, count_queries):
        """Query count must not grow with the number of conversations."""
        login("+15550000001", "Alice")
        one = start_direct(client, cast["bob"].id)
        send(client, one["id"], "hi")

        with count_queries() as first:
            client.get("/api/conversations")

        for who in ("carol", "dave"):
            conv = start_direct(client, cast[who].id)
            send(client, conv["id"], "hi")

        with count_queries() as third:
            assert len(client.get("/api/conversations").json()) == 3

        assert len(third) == len(first), (
            f"1 conversation took {len(first)} queries, 3 took {len(third)} — N+1"
        )


class TestUnreadCounts:
    def test_my_own_messages_are_never_unread(self, client, login, cast):
        login("+15550000001", "Alice")
        conv = start_direct(client, cast["bob"].id)
        send(client, conv["id"], "hello")
        assert client.get("/api/conversations").json()[0]["unread_count"] == 0

    def test_counts_messages_from_the_other_person(self, client, login, cast):
        login("+15550000001", "Alice")
        conv = start_direct(client, cast["bob"].id)

        client.post("/api/auth/logout")
        login("+15550000002")
        send(client, conv["id"], "one")
        send(client, conv["id"], "two")

        client.post("/api/auth/logout")
        login("+15550000001")
        assert client.get("/api/conversations").json()[0]["unread_count"] == 2

    def test_marking_read_clears_the_badge(self, client, login, cast):
        login("+15550000001", "Alice")
        conv = start_direct(client, cast["bob"].id)

        client.post("/api/auth/logout")
        login("+15550000002")
        last = send(client, conv["id"], "unread please")

        client.post("/api/auth/logout")
        login("+15550000001")
        assert client.get("/api/conversations").json()[0]["unread_count"] == 1

        assert client.post(f"/api/conversations/{conv['id']}/read",
                           json={"message_id": last["id"]}).status_code == 200
        assert client.get("/api/conversations").json()[0]["unread_count"] == 0


class TestAccessControl:
    def test_cannot_read_a_conversation_i_am_not_in(self, client, login, cast, db):
        from app.db.models import Conversation, ConversationMember

        theirs = Conversation(type="direct", created_by=cast["bob"].id)
        db.add(theirs)
        db.commit()
        db.add_all([
            ConversationMember(conversation_id=theirs.id, user_id=cast["bob"].id),
            ConversationMember(conversation_id=theirs.id, user_id=cast["carol"].id),
        ])
        db.commit()

        login("+15550000001", "Alice")
        assert client.get(f"/api/conversations/{theirs.id}").status_code == 403
        assert client.get(f"/api/conversations/{theirs.id}/messages").status_code == 403
        assert client.post(
            f"/api/conversations/{theirs.id}/messages", json={"body": "intruding"}
        ).status_code == 403

    def test_listing_requires_a_session(self, client):
        assert client.get("/api/conversations").status_code == 401
