import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.models import Base


@pytest.fixture()
def engine():
    # StaticPool + check_same_thread=False: TestClient serves requests on a
    # worker thread, and the default SingletonThreadPool would hand that thread
    # its own empty in-memory database.
    eng = create_engine(
        "sqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite ignores foreign keys unless asked; we rely on them for cascades.
    @event.listens_for(eng, "connect")
    def _fk_on(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    return eng


@pytest.fixture()
def db(engine):
    with Session(engine, future=True) as session:
        yield session


@pytest.fixture()
def client(engine):
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.main import create_app

    app = create_app(init_db=False)

    def _override():
        with Session(engine, future=True) as session:
            yield session

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
