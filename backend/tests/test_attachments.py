"""Attachments ride inline as data URIs, so validation is the whole feature."""

import base64

import pytest

from app.services.attachments import MAX_ATTACHMENT_BYTES
from tests.helpers import sign_in


@pytest.fixture()
def cast(client):
    return {
        "alice": sign_in(client, "+15550000001", "Alice Chen"),
        "bob": sign_in(client, "+15550000002", "Bob Martinez"),
    }


def data_uri(mime: str, raw: bytes) -> str:
    return f"data:{mime};base64," + base64.b64encode(raw).decode()


PNG = data_uri("image/png", b"pretend png bytes")
PDF = data_uri("application/pdf", b"%PDF-1.4 pretend")


def direct(cast):
    response = cast["alice"].post("/api/conversations", json={"user_id": cast["bob"].id})
    return response.json()


def attach(actor, conv_id, files, body=""):
    return actor.post(
        f"/api/conversations/{conv_id}/messages", json={"body": body, "attachments": files}
    )


class TestSendingAnAttachment:
    def test_an_image_arrives_with_its_metadata(self, cast):
        conv = direct(cast)
        response = attach(
            cast["alice"],
            conv["id"],
            [{"name": "beach.png", "mime": "image/png", "data_url": PNG, "width": 800, "height": 600}],
        )
        assert response.status_code == 201, response.text

        [file] = response.json()["attachments"]
        assert file["name"] == "beach.png"
        assert file["is_image"] is True
        assert file["size"] == len(b"pretend png bytes")
        assert (file["width"], file["height"]) == (800, 600)

    def test_a_caption_is_optional(self, cast):
        conv = direct(cast)
        response = attach(cast["alice"], conv["id"], [{"name": "a.png", "mime": "image/png", "data_url": PNG}])
        assert response.status_code == 201
        assert response.json()["body"] == ""

    def test_a_caption_rides_along_when_given(self, cast):
        conv = direct(cast)
        response = attach(
            cast["alice"], conv["id"], [{"name": "a.png", "mime": "image/png", "data_url": PNG}], body="look"
        )
        assert response.json()["body"] == "look"

    def test_a_non_image_carries_no_dimensions(self, cast):
        conv = direct(cast)
        response = attach(
            cast["alice"],
            conv["id"],
            [{"name": "notes.pdf", "mime": "application/pdf", "data_url": PDF, "width": 10, "height": 10}],
        )
        [file] = response.json()["attachments"]
        assert file["is_image"] is False
        assert file["width"] is None and file["height"] is None

    def test_the_recipient_sees_it(self, cast):
        conv = direct(cast)
        attach(cast["alice"], conv["id"], [{"name": "a.png", "mime": "image/png", "data_url": PNG}])

        messages = cast["bob"].get(f"/api/conversations/{conv['id']}/messages").json()
        assert len(messages[0]["attachments"]) == 1

    def test_it_survives_a_reload(self, cast):
        conv = direct(cast)
        attach(cast["alice"], conv["id"], [{"name": "a.png", "mime": "image/png", "data_url": PNG}])

        [message] = cast["alice"].get(f"/api/conversations/{conv['id']}/messages").json()
        assert message["attachments"][0]["data_url"] == PNG


class TestWhatIsRefused:
    def test_an_empty_message_with_no_attachment(self, cast):
        conv = direct(cast)
        response = attach(cast["alice"], conv["id"], [])
        assert response.status_code == 400

    def test_whitespace_is_not_a_message(self, cast):
        conv = direct(cast)
        response = attach(cast["alice"], conv["id"], [], body="   ")
        assert response.status_code == 400

    def test_an_executable_type(self, cast):
        conv = direct(cast)
        response = attach(
            cast["alice"],
            conv["id"],
            [{"name": "x.svg", "mime": "image/svg+xml", "data_url": data_uri("image/svg+xml", b"<svg/>")}],
        )
        # SVG runs script when opened, so it is not in the allowed set.
        assert response.status_code == 400

    def test_a_mime_that_lies_about_its_contents(self, cast):
        conv = direct(cast)
        response = attach(
            cast["alice"], conv["id"], [{"name": "x.png", "mime": "image/png", "data_url": PDF}]
        )
        assert response.status_code == 400

    def test_something_that_is_not_a_data_uri(self, cast):
        conv = direct(cast)
        response = attach(
            cast["alice"],
            conv["id"],
            [{"name": "x.png", "mime": "image/png", "data_url": "https://example.com/x.png"}],
        )
        assert response.status_code == 400

    def test_a_file_over_the_size_cap(self, cast):
        conv = direct(cast)
        huge = data_uri("image/png", b"\x00" * (MAX_ATTACHMENT_BYTES + 1))
        response = attach(cast["alice"], conv["id"], [{"name": "big.png", "mime": "image/png", "data_url": huge}])
        assert response.status_code == 400
        assert "MB" in response.json()["detail"]

    def test_too_many_at_once(self, cast):
        conv = direct(cast)
        many = [{"name": f"{i}.png", "mime": "image/png", "data_url": PNG} for i in range(11)]
        assert attach(cast["alice"], conv["id"], many).status_code == 400

    def test_a_rejected_upload_leaves_no_message_behind(self, cast):
        conv = direct(cast)
        attach(cast["alice"], conv["id"], [{"name": "x.png", "mime": "image/png", "data_url": PDF}])
        assert cast["alice"].get(f"/api/conversations/{conv['id']}/messages").json() == []

    def test_a_path_in_the_filename_is_flattened(self, cast):
        conv = direct(cast)
        response = attach(
            cast["alice"],
            conv["id"],
            [{"name": "../../etc/passwd", "mime": "image/png", "data_url": PNG}],
        )
        assert "/" not in response.json()["attachments"][0]["name"]
