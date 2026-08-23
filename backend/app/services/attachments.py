"""Inline attachments.

There is no object storage in this build, so bytes ride along as data URIs —
the same compromise the profile photos make. That puts a hard ceiling on size,
which is enforced here rather than in the route so every caller inherits it.
"""

import base64
import binascii
import re

from fastapi import HTTPException, status

from app.db.models import Attachment
from app.schemas.conversation import AttachmentIn

# 4 MB decoded. Base64 inflates by a third, so the stored column is ~5.3 MB.
MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024
MAX_PER_MESSAGE = 10

# Deliberately narrow: these render or download safely. SVG is excluded — it
# executes script when opened, and a data-URI SVG would run same-origin.
ALLOWED_MIME = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/zip",
    "audio/mpeg",
    "audio/ogg",
    "video/mp4",
}

_DATA_URI = re.compile(r"^data:(?P<mime>[\w.+-]+/[\w.+-]+);base64,(?P<payload>[A-Za-z0-9+/=\s]+)$")


def _reject(detail: str) -> None:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, detail)


def decode_size(data_url: str, declared_mime: str) -> tuple[str, int]:
    """Validate the data URI and return its real mime and decoded byte count.

    The mime inside the URI wins over the one the client declared: a client
    could otherwise label a payload `image/png` and have it stored as such.
    """
    match = _DATA_URI.match(data_url.strip())
    if match is None:
        _reject("Attachments must be base64 data URIs")

    mime = match.group("mime").lower()
    if mime not in ALLOWED_MIME:
        _reject(f"{mime} files are not supported")
    if declared_mime.lower() != mime:
        _reject("Attachment type does not match its contents")

    try:
        raw = base64.b64decode(match.group("payload"), validate=False)
    except (binascii.Error, ValueError):
        _reject("That attachment is not valid base64")

    if not raw:
        _reject("That attachment is empty")
    if len(raw) > MAX_ATTACHMENT_BYTES:
        limit = MAX_ATTACHMENT_BYTES // (1024 * 1024)
        _reject(f"Attachments must be under {limit} MB")

    return mime, len(raw)


def build(items: list[AttachmentIn]) -> list[Attachment]:
    """Turn validated input into rows. Raises 400 on anything unusable."""
    if len(items) > MAX_PER_MESSAGE:
        _reject(f"At most {MAX_PER_MESSAGE} attachments per message")

    rows = []
    for item in items:
        mime, size = decode_size(item.data_url, item.mime)
        rows.append(
            Attachment(
                # Strip any path a browser might include, so the download name
                # can never escape into a directory.
                name=item.name.strip().replace("/", "_").replace("\\", "_")[:255],
                mime=mime,
                size=size,
                data_url=item.data_url.strip(),
                width=item.width if mime.startswith("image/") else None,
                height=item.height if mime.startswith("image/") else None,
            )
        )
    return rows
