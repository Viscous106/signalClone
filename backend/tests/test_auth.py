"""Auth is mocked per the brief: no passwords, OTP is a constant."""

import pytest

from app.core.config import get_settings
from app.db.models import User

OTP = get_settings().mock_otp


def start(client, phone="+15551234567"):
    return client.post("/api/auth/start", json={"phone": phone})


def register(client, phone="+15551234567", name="New Person"):
    start(client, phone)
    return client.post(
        "/api/auth/verify", json={"phone": phone, "code": OTP, "display_name": name}
    )


class TestAuthStart:
    def test_reports_a_new_phone_as_new(self, client):
        r = start(client, "+15559998888")
        assert r.status_code == 200
        assert r.json() == {"otp_sent": True, "is_new": True}

    def test_reports_a_known_phone_as_returning(self, client, db):
        db.add(User(phone="+15550000009", display_name="Existing"))
        db.commit()
        assert start(client, "+15550000009").json()["is_new"] is False

    def test_rejects_a_phone_that_is_not_a_phone(self, client):
        assert start(client, "hello").status_code == 422

    @pytest.mark.parametrize(
        "written",
        ["+1 555 123 4567", "+1-555-123-4567", "  +15551234567  ", "+1 (555) 123-4567"],
    )
    def test_normalises_however_the_number_is_typed(self, client, written):
        """All of these are one person, so none may create a second account."""
        register(client, phone="+15551234567", name="Alice")
        assert start(client, written).json()["is_new"] is False


class TestAuthVerify:
    def test_registers_a_new_user_and_starts_a_session(self, client):
        r = register(client, name="Alice Chen")
        assert r.status_code == 200
        body = r.json()
        assert body["display_name"] == "Alice Chen"
        assert body["avatar_color"].startswith("#")
        assert "session" in r.cookies

    def test_rejects_a_wrong_code(self, client):
        start(client)
        r = client.post(
            "/api/auth/verify",
            json={"phone": "+15551234567", "code": "000000", "display_name": "X"},
        )
        assert r.status_code == 400
        assert "code" in r.json()["detail"].lower()

    def test_new_user_must_supply_a_display_name(self, client):
        start(client)
        r = client.post("/api/auth/verify", json={"phone": "+15551234567", "code": OTP})
        assert r.status_code == 400
        assert "display name" in r.json()["detail"].lower()

    def test_returning_user_needs_no_display_name(self, client, db):
        register(client, phone="+15551110000", name="Bob")
        r = client.post("/api/auth/verify", json={"phone": "+15551110000", "code": OTP})
        assert r.status_code == 200
        assert r.json()["display_name"] == "Bob"
        assert db.query(User).filter_by(phone="+15551110000").count() == 1

    def test_logging_in_again_does_not_rename_the_user(self, client):
        register(client, phone="+15551110001", name="Carol")
        r = client.post(
            "/api/auth/verify",
            json={"phone": "+15551110001", "code": OTP, "display_name": "Impostor"},
        )
        assert r.json()["display_name"] == "Carol"


class TestSession:
    def test_me_requires_a_session(self, client):
        assert client.get("/api/users/me").status_code == 401

    def test_me_returns_the_logged_in_user(self, client):
        register(client, name="Alice Chen")
        r = client.get("/api/users/me")
        assert r.status_code == 200
        assert r.json()["display_name"] == "Alice Chen"

    def test_session_survives_across_requests(self, client):
        register(client, name="Alice")
        assert client.get("/api/users/me").status_code == 200
        assert client.get("/api/users/me").status_code == 200

    def test_logout_ends_the_session(self, client):
        register(client)
        assert client.post("/api/auth/logout").status_code == 200
        assert client.get("/api/users/me").status_code == 401

    def test_a_garbage_cookie_is_rejected(self, client):
        client.cookies.set("session", "not-a-jwt")
        assert client.get("/api/users/me").status_code == 401

    def test_a_token_for_a_deleted_user_is_rejected(self, client, db):
        register(client, phone="+15552220000")
        db.query(User).filter_by(phone="+15552220000").delete()
        db.commit()
        assert client.get("/api/users/me").status_code == 401


class TestProfile:
    def test_can_update_display_name_and_about(self, client):
        register(client, name="Alice")
        r = client.patch("/api/users/me", json={"display_name": "Alice C", "about": "Busy"})
        assert r.status_code == 200
        assert r.json()["display_name"] == "Alice C"
        assert r.json()["about"] == "Busy"

    def test_rejects_an_empty_display_name(self, client):
        register(client)
        assert client.patch("/api/users/me", json={"display_name": "  "}).status_code == 422

    def test_updating_requires_a_session(self, client):
        assert client.patch("/api/users/me", json={"display_name": "X"}).status_code == 401
