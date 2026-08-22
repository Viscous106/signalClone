from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .../backend/app/core/config.py -> .../backend
BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Signal Clone API"
    # Absolute, so the database does not change with the working directory.
    database_url: str = f"sqlite:///{BACKEND_DIR / 'signal.db'}"

    # Mocked auth: the OTP is a constant, per the assignment brief.
    mock_otp: str = "123456"
    # Must be >= 32 bytes for HMAC-SHA256; override via JWT_SECRET in production.
    jwt_secret: str = "dev-only-secret-replace-me-in-production-32b"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30

    cors_origins: list[str] = ["http://localhost:3000"]
    seed_on_boot: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
