"""Shared field types. Normalisation lives here so every route agrees."""

import re
from typing import Annotated

from pydantic import AfterValidator

_DIGITS = re.compile(r"\D")


def normalise_phone(value: str) -> str:
    """`+1 (555) 123-4567` and `+15551234567` are the same person.

    Without this, one human could register several accounts by varying
    punctuation, and login would silently fail to find them.
    """
    digits = _DIGITS.sub("", value.strip())
    if not 7 <= len(digits) <= 15:
        raise ValueError("must be a phone number with 7 to 15 digits")
    return f"+{digits}"


def strip_required(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("must not be blank")
    return cleaned


Phone = Annotated[str, AfterValidator(normalise_phone)]
NonBlank = Annotated[str, AfterValidator(strip_required)]
