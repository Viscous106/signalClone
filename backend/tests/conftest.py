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
def app(engine):
    """One app instance per test, wired to the in-memory database.

    Shared by every client in a test so that realtime state (the WebSocket
    connection manager, which lives on app.state) is common between them.
    """
    from app.db.session import get_db
    from app.main import create_app

    application = create_app(init_db=False)

    def _override():
        with Session(engine, future=True) as session:
            yield session

    application.dependency_overrides[get_db] = _override
    # The WebSocket route uses this factory, not the HTTP dependency.
    application.state.session_factory = lambda: Session(engine, future=True)
    return application


@pytest.fixture()
def client(app):
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def make_user(db):
    """Create a user directly, bypassing the auth flow."""
    from app.db.models import User, pick_avatar_color

    def _make(phone: str, display_name: str, **kwargs):
        user = User(
            phone=phone,
            display_name=display_name,
            avatar_color=pick_avatar_color(phone),
            **kwargs,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _make


@pytest.fixture()
def login(client):
    """Sign the shared client in as a phone number, registering if needed."""
    from app.core.config import get_settings

    def _login(phone: str, display_name: str | None = None):
        body: dict[str, str] = {"phone": phone, "code": get_settings().mock_otp}
        if display_name:
            body["display_name"] = display_name
        response = client.post("/api/auth/verify", json=body)
        assert response.status_code == 200, response.text
        return response.json()

    return _login


@pytest.fixture()
def count_queries(engine):
    """Count SQL statements, to prove list endpoints do not go N+1."""
    from contextlib import contextmanager

    from sqlalchemy import event

    @contextmanager
    def _counter():
        statements: list[str] = []

        def _record(conn, cursor, statement, params, context, executemany):
            statements.append(statement)

        event.listen(engine, "before_cursor_execute", _record)
        try:
            yield statements
        finally:
            event.remove(engine, "before_cursor_execute", _record)

    return _counter
