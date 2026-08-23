"""Setting a profile photo.

There is no object storage in this build, so a photo is carried inline as a
data URI. That keeps it working on a host with an ephemeral disk.
"""

import pytest

from app.schemas.user import MAX_AVATAR_CHARS
from tests.helpers import sign_in

TINY_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)


@pytest.fixture()
def me(client, db):
    from app.seed import seed

    seed(db)
    return sign_in(client, "+15559990001", "Photo Person")


class TestSettingAPhoto:
    def test_accepts_an_inline_image(self, me):
        r = me.patch("/api/users/me", json={"avatar_url": TINY_PNG})
        assert r.status_code == 200
        assert r.json()["avatar_url"] == TINY_PNG

    def test_survives_a_reload(self, me):
        me.patch("/api/users/me", json={"avatar_url": TINY_PNG})
        assert me.get("/api/users/me").json()["avatar_url"] == TINY_PNG

    def test_accepts_a_plain_https_url(self, me):
        r = me.patch("/api/users/me", json={"avatar_url": "https://example.test/a.png"})
        assert r.status_code == 200

    def test_can_be_removed_to_fall_back_to_initials(self, me):
        me.patch("/api/users/me", json={"avatar_url": TINY_PNG})
        r = me.patch("/api/users/me", json={"avatar_url": None})
        assert r.status_code == 200
        assert r.json()["avatar_url"] is None
        # The colour pair is still there to draw initials with.
        assert r.json()["avatar_color"].startswith("#")

    def test_the_photo_reaches_other_people(self, client, me, db):
        """A profile photo is only useful if contacts see it."""
        me.patch("/api/users/me", json={"avatar_url": TINY_PNG})
        alice = sign_in(client, "+15550000001")

        contacts = alice.get("/api/contacts").json()
        mine = next(c for c in contacts if c["display_name"] == "Photo Person")
        assert mine["avatar_url"] == TINY_PNG


class TestRejectingRubbish:
    def test_refuses_a_non_image_data_uri(self, me):
        r = me.patch("/api/users/me", json={"avatar_url": "data:text/html;base64,PHNjcmlwdD4="})
        assert r.status_code == 422

    def test_refuses_a_javascript_url(self, me):
        r = me.patch("/api/users/me", json={"avatar_url": "javascript:alert(1)"})
        assert r.status_code == 422

    def test_refuses_something_that_is_not_a_url_at_all(self, me):
        assert me.patch("/api/users/me", json={"avatar_url": "hello there"}).status_code == 422

    def test_refuses_an_image_too_large_to_store(self, me):
        oversized = "data:image/png;base64," + ("A" * (MAX_AVATAR_CHARS + 1))
        r = me.patch("/api/users/me", json={"avatar_url": oversized})
        assert r.status_code == 422

    def test_accepts_one_just_within_the_limit(self, me):
        ok = "data:image/png;base64," + ("A" * 1000)
        assert me.patch("/api/users/me", json={"avatar_url": ok}).status_code == 200
