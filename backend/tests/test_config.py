from pathlib import Path

from app.core.config import Settings


class TestDatabasePath:
    def test_default_is_absolute(self):
        """A relative sqlite path silently changes database with the working
        directory: running a script from the repo root opened a different,
        empty file than the server was using."""
        url = Settings().database_url
        assert url.startswith("sqlite:////") or Path(url.split("sqlite:///")[-1]).is_absolute()

    def test_default_lives_beside_the_backend_package(self):
        path = Path(Settings().database_url.split("sqlite:///")[-1])
        assert path.name == "signal.db"
        assert (path.parent / "app" / "main.py").exists()

    def test_env_can_still_override(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "sqlite:///./other.db")
        assert Settings().database_url == "sqlite:///./other.db"
