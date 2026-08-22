"""Serving the built frontend from the API."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.web import mount_frontend


@pytest.fixture()
def bundle(tmp_path):
    """A miniature stand-in for `frontend/out`."""
    (tmp_path / "_next" / "static").mkdir(parents=True)
    (tmp_path / "_next" / "static" / "app.js").write_text("console.log('app')")
    (tmp_path / "index.html").write_text("<html>shell</html>")
    (tmp_path / "icon.svg").write_text("<svg/>")
    (tmp_path / "login").mkdir()
    (tmp_path / "login" / "index.html").write_text("<html>login</html>")
    (tmp_path / "secret.txt").write_text("not served on purpose")
    return tmp_path


@pytest.fixture()
def web(bundle):
    app = FastAPI()

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    assert mount_frontend(app, bundle) is True
    return TestClient(app)


class TestServingTheBundle:
    def test_serves_the_shell_at_the_root(self, web):
        response = web.get("/")
        assert response.status_code == 200
        assert "shell" in response.text

    def test_serves_a_directory_route(self, web):
        assert "login" in web.get("/login/").text

    def test_serves_a_directory_route_without_the_slash(self, web):
        assert "login" in web.get("/login").text

    def test_serves_static_assets(self, web):
        assert web.get("/_next/static/app.js").status_code == 200

    def test_serves_a_top_level_file(self, web):
        assert web.get("/icon.svg").status_code == 200

    def test_falls_back_to_the_shell_for_client_routes(self, web):
        """A deep link the export has no file for still boots the app."""
        response = web.get("/chat")
        assert response.status_code == 200
        assert "shell" in response.text


class TestItDoesNotShadowTheApi:
    def test_api_routes_still_work(self, web):
        assert web.get("/api/health").json() == {"status": "ok"}

    def test_unknown_api_routes_answer_json_not_html(self, web):
        """An HTML 200 here would quietly hide a client's typo."""
        response = web.get("/api/nope")
        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}

    def test_the_socket_path_is_not_swallowed(self, web):
        assert web.get("/ws").status_code == 404


class TestSafety:
    def test_refuses_to_escape_the_bundle(self, web):
        response = web.get("/../../etc/passwd")
        assert "root:" not in response.text

    def test_missing_bundle_is_not_fatal(self, tmp_path):
        app = FastAPI()
        assert mount_frontend(app, tmp_path) is False
