from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def build_engine(url: str | None = None) -> Engine:
    url = url or get_settings().database_url
    engine = create_engine(
        url,
        future=True,
        # SQLite + threaded server: the connection must be shareable.
        connect_args={"check_same_thread": False} if url.startswith("sqlite") else {},
    )

    # SQLite ignores foreign keys unless explicitly enabled, and our cascades
    # depend on them.
    @event.listens_for(engine, "connect")
    def _enable_fk(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return engine


engine = build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, future=True)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
