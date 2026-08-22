"""Small CLI behind the Makefile's db targets."""

import sys

from app.db.models import (
    Contact,
    Conversation,
    ConversationMember,
    Message,
    MessageReceipt,
    User,
)
from app.db.session import SessionLocal

TABLES = (User, Contact, Conversation, ConversationMember, Message, MessageReceipt)


def info() -> None:
    """Print a row count per table, so `make db` shows what it produced."""
    with SessionLocal() as db:
        for model in TABLES:
            print(f"    {model.__tablename__:22} {db.query(model).count()}")


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else "info"

    if command == "init":
        from app.main import init_database

        init_database()
        info()
    elif command == "info":
        info()
    else:
        print(f"unknown command: {command}\nusage: python -m app.cli [init|info]")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
