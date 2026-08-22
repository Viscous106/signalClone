from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, contacts, conversations, messages, users
from app.web import mount_frontend
from app.ws import routes as ws_routes
from app.ws.manager import ConnectionManager
from app.core.config import get_settings
from app.db.models import Base
from app.db.session import SessionLocal, engine


def init_database() -> None:
    """No Alembic: single-developer SQLite, so create_all is honest and enough."""
    Base.metadata.create_all(engine)
    if get_settings().seed_on_boot:
        from app.seed import seed

        with SessionLocal() as db:
            seed(db)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_database()
    yield


def create_app(init_db: bool = True) -> FastAPI:
    """`init_db=False` in tests, so they never touch the real signal.db."""
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan if init_db else None)

    # One registry per app instance, so tests never share socket state.
    app.state.ws_manager = ConnectionManager()
    # The WebSocket route opens short sessions of its own rather than holding
    # one for the life of the connection. Tests point this at their engine.
    app.state.session_factory = SessionLocal

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(contacts.router)
    app.include_router(conversations.router)
    app.include_router(messages.router)
    app.include_router(ws_routes.router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    # Last, so the catch-all cannot shadow an API route.
    app.state.frontend_mounted = mount_frontend(app)

    return app


app = create_app()
