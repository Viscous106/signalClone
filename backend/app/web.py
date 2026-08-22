"""Serve the built frontend from the API.

One service, one origin: no CORS, no reverse proxy, and the WebSocket lives on
the same host as the page. The frontend is a static export, so this is plain
file serving plus a fallback for client-side routes.
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# .../backend/app/web.py -> .../frontend/out
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend" / "out"


def mount_frontend(app: FastAPI, directory: Path | None = None) -> bool:
    """Attach the static bundle. Returns False when it has not been built."""
    root = directory or FRONTEND_DIR
    if not (root / "index.html").exists():
        return False

    # Hashed asset filenames, so they can be cached hard.
    app.mount("/_next", StaticFiles(directory=root / "_next"), name="next-assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        """Resolve a URL to a file, else fall back to the app shell."""
        # Never let a mistyped API route fall through to HTML: a JSON client
        # deserves JSON, and an HTML 200 would hide the mistake.
        if path.startswith("api/") or path == "ws":
            return JSONResponse({"detail": "Not Found"}, status_code=404)

        candidate = (root / path).resolve()
        # Refuse anything that escapes the bundle via `..`.
        if root in candidate.parents or candidate == root:
            if candidate.is_file():
                return FileResponse(candidate)
            index = candidate / "index.html"
            if index.is_file():
                return FileResponse(index)

        return FileResponse(root / "index.html")

    return True
