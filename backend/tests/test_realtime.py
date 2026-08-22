"""Realtime behaviour: live delivery, receipts, and typing indicators.

All actors share ONE TestClient. Each TestClient runs its own event loop, and
the connection manager would then be awaiting sockets that belong to a
different loop — which deadlocks. Production has a single loop, so identity is
carried per request via the Cookie header instead.
"""

import pytest

OTP = "123456"


class Actor:
    """One signed-in person, acting through the shared client."""

    def __init__(self, client, user, token):
        self.client = client
        self.user = user
        self._headers = {"Cookie": f"session={token}"}

    @property
    def id(self) -> int:
        return self.user["id"]

    def post(self, url, **kwargs):
        return self.client.post(url, headers=self._headers, **kwargs)

    def get(self, url, **kwargs):
        return self.client.get(url, headers=self._headers, **kwargs)

    def ws(self):
        return self.client.websocket_connect("/ws", headers=self._headers)


def sign_in(client, phone: str, name: str | None = None) -> Actor:
    body = {"phone": phone, "code": OTP}
    if name:
        body["display_name"] = name
    response = client.post("/api/auth/verify", json=body)
    assert response.status_code == 200, response.text
    token = response.cookies["session"]
    # Keep the jar empty so no request inherits an identity by accident.
    client.cookies.clear()
    return Actor(client, response.json(), token)


@pytest.fixture()
def pair(client):
    """Alice and Bob, already in a direct conversation."""
    alice = sign_in(client, "+15550000001", "Alice Chen")
    bob = sign_in(client, "+15550000002", "Bob Martinez")
    conversation = alice.post("/api/conversations", json={"user_id": bob.id}).json()
    return {"alice": alice, "bob": bob, "conversation": conversation}


def drain(ws, kind: str, tries: int = 6):
    """Read frames until one of `kind` shows up, ignoring unrelated traffic."""
    for _ in range(tries):
        frame = ws.receive_json()
        if frame["type"] == kind:
            return frame
    raise AssertionError(f"never saw a {kind} frame")


def assert_absent(ws, kind: str) -> None:
    """Assert no frame of `kind` is waiting.

    A plain `receive_json()` would block forever when nothing is coming, so
    round-trip a ping instead: frames on one socket arrive in order, so
    anything already queued shows up before the pong.
    """
    ws.send_json({"type": "ping", "payload": {}})
    while True:
        frame = ws.receive_json()
        if frame["type"] == "pong":
            return
        assert frame["type"] != kind, f"{kind} should not have been sent"


class TestConnecting:
    def test_rejects_a_client_with_no_session(self, client):
        from starlette.websockets import WebSocketDisconnect

        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()

    def test_accepts_a_signed_in_client(self, client):
        alice = sign_in(client, "+15550000001", "Alice")
        with alice.ws() as ws:
            assert ws.receive_json()["type"] == "ready"


class TestLiveDelivery:
    def test_the_other_member_receives_the_message(self, pair):
        with pair["bob"].ws() as bob_ws:
            drain(bob_ws, "ready")
            pair["alice"].post(
                f"/api/conversations/{pair['conversation']['id']}/messages",
                json={"body": "hello over the wire"},
            )
            frame = drain(bob_ws, "message.new")

        assert frame["payload"]["body"] == "hello over the wire"
        assert frame["payload"]["conversation_id"] == pair["conversation"]["id"]

    def test_the_sender_also_receives_it_for_their_other_tabs(self, pair):
        with pair["alice"].ws() as alice_ws:
            drain(alice_ws, "ready")
            pair["alice"].post(
                f"/api/conversations/{pair['conversation']['id']}/messages",
                json={"body": "echo to my other tabs"},
            )
            assert drain(alice_ws, "message.new")["payload"]["body"] == "echo to my other tabs"

    def test_outsiders_never_see_it(self, pair, client):
        outsider = sign_in(client, "+15550000009", "Nosy Parker")

        with outsider.ws() as nosy_ws:
            drain(nosy_ws, "ready")
            pair["alice"].post(
                f"/api/conversations/{pair['conversation']['id']}/messages",
                json={"body": "private"},
            )
            assert_absent(nosy_ws, "message.new")


class TestReceipts:
    def test_a_message_starts_as_sent_when_nobody_is_connected(self, pair):
        sent = pair["alice"].post(
            f"/api/conversations/{pair['conversation']['id']}/messages",
            json={"body": "into the void"},
        ).json()
        assert sent["status"] == "sent"

    def test_becomes_delivered_when_the_recipient_is_connected(self, pair):
        conv_id = pair["conversation"]["id"]
        with pair["bob"].ws() as bob_ws:
            drain(bob_ws, "ready")
            with pair["alice"].ws() as alice_ws:
                drain(alice_ws, "ready")
                pair["alice"].post(
                    f"/api/conversations/{conv_id}/messages", json={"body": "are you there"}
                )
                status = drain(alice_ws, "message.status")

        assert status["payload"]["status"] == "delivered"

    def test_becomes_read_when_the_recipient_opens_the_chat(self, pair):
        conv_id = pair["conversation"]["id"]
        with pair["bob"].ws() as bob_ws:
            drain(bob_ws, "ready")
            sent = pair["alice"].post(
                f"/api/conversations/{conv_id}/messages", json={"body": "read this"}
            ).json()

            with pair["alice"].ws() as alice_ws:
                drain(alice_ws, "ready")
                pair["bob"].post(
                    f"/api/conversations/{conv_id}/read", json={"message_id": sent["id"]}
                )
                status = drain(alice_ws, "message.status")

        assert status["payload"]["status"] == "read"
        assert status["payload"]["message_id"] == sent["id"]

    def test_status_survives_a_reload(self, pair):
        """The ticks come from the database, not from whatever the socket saw."""
        conv_id = pair["conversation"]["id"]
        sent = pair["alice"].post(
            f"/api/conversations/{conv_id}/messages", json={"body": "persisted"}
        ).json()
        pair["bob"].post(
            f"/api/conversations/{conv_id}/read", json={"message_id": sent["id"]}
        )

        history = pair["alice"].get(f"/api/conversations/{conv_id}/messages").json()
        assert history[0]["status"] == "read"

    def test_incoming_messages_carry_no_status(self, pair):
        """Ticks belong to the sender; showing them on a received message is wrong."""
        conv_id = pair["conversation"]["id"]
        pair["bob"].post(f"/api/conversations/{conv_id}/messages", json={"body": "hi"})

        history = pair["alice"].get(f"/api/conversations/{conv_id}/messages").json()
        assert history[0]["status"] is None

    def test_reading_does_not_go_backwards(self, pair):
        conv_id = pair["conversation"]["id"]
        first = pair["alice"].post(
            f"/api/conversations/{conv_id}/messages", json={"body": "one"}
        ).json()
        second = pair["alice"].post(
            f"/api/conversations/{conv_id}/messages", json={"body": "two"}
        ).json()

        pair["bob"].post(f"/api/conversations/{conv_id}/read", json={"message_id": second["id"]})
        pair["bob"].post(f"/api/conversations/{conv_id}/read", json={"message_id": first["id"]})

        rows = pair["alice"].get(f"/api/conversations/{conv_id}/messages").json()
        assert all(m["status"] == "read" for m in rows)


class TestClientId:
    def test_is_echoed_back_so_the_sender_can_reconcile(self, pair):
        """The optimistic bubble must be matched exactly, not guessed at by
        comparing body text and timestamps."""
        conv_id = pair["conversation"]["id"]
        with pair["alice"].ws() as alice_ws:
            drain(alice_ws, "ready")
            response = pair["alice"].post(
                f"/api/conversations/{conv_id}/messages",
                json={"body": "hello", "client_id": "abc-123"},
            ).json()
            frame = drain(alice_ws, "message.new")

        assert response["client_id"] == "abc-123"
        assert frame["payload"]["client_id"] == "abc-123"

    def test_is_absent_when_not_supplied(self, pair):
        conv_id = pair["conversation"]["id"]
        response = pair["alice"].post(
            f"/api/conversations/{conv_id}/messages", json={"body": "hello"}
        ).json()
        assert response["client_id"] is None


class TestTyping:
    def test_is_relayed_to_the_other_member(self, pair):
        conv_id = pair["conversation"]["id"]
        with pair["bob"].ws() as bob_ws:
            drain(bob_ws, "ready")
            with pair["alice"].ws() as alice_ws:
                drain(alice_ws, "ready")
                alice_ws.send_json(
                    {"type": "typing", "payload": {"conversation_id": conv_id, "is_typing": True}}
                )
                frame = drain(bob_ws, "typing")

        assert frame["payload"]["conversation_id"] == conv_id
        assert frame["payload"]["user_id"] == pair["alice"].id
        assert frame["payload"]["is_typing"] is True

    def test_is_not_echoed_back_to_the_typist(self, pair):
        conv_id = pair["conversation"]["id"]
        with pair["alice"].ws() as alice_ws:
            drain(alice_ws, "ready")
            alice_ws.send_json(
                {"type": "typing", "payload": {"conversation_id": conv_id, "is_typing": True}}
            )
            assert_absent(alice_ws, "typing")

    def test_ignores_typing_for_a_conversation_i_am_not_in(self, pair, client):
        outsider = sign_in(client, "+15550000009", "Nosy")
        conv_id = pair["conversation"]["id"]

        with pair["bob"].ws() as bob_ws:
            drain(bob_ws, "ready")
            with outsider.ws() as nosy_ws:
                drain(nosy_ws, "ready")
                nosy_ws.send_json(
                    {"type": "typing", "payload": {"conversation_id": conv_id, "is_typing": True}}
                )
                assert_absent(nosy_ws, "typing")

            assert_absent(bob_ws, "typing")
