from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, users
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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(users.router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
