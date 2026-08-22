"""In-process WebSocket registry.

One instance lives on `app.state`, so tests get a fresh registry per app and
nothing leaks between them. Scaling past a single worker would mean replacing
this with Redis pub/sub — the interface is deliberately small enough for that.
"""

from collections.abc import Iterable

import anyio
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # One user can have several sockets open: multiple tabs or devices.
        self._sockets: dict[int, set[WebSocket]] = {}

    async def connect(self, user_id: int, socket: WebSocket) -> None:
        await socket.accept()
        self._sockets.setdefault(user_id, set()).add(socket)

    def disconnect(self, user_id: int, socket: WebSocket) -> None:
        sockets = self._sockets.get(user_id)
        if not sockets:
            return
        sockets.discard(socket)
        if not sockets:
            del self._sockets[user_id]

    def is_online(self, user_id: int) -> bool:
        return bool(self._sockets.get(user_id))

    def online_among(self, user_ids: Iterable[int]) -> set[int]:
        return {uid for uid in user_ids if self.is_online(uid)}

    async def send(self, user_ids: Iterable[int], event: dict) -> None:
        for user_id in list(user_ids):
            for socket in list(self._sockets.get(user_id, ())):
                try:
                    await socket.send_json(event)
                except Exception:
                    # The peer vanished mid-send; drop it rather than failing
                    # the whole broadcast.
                    self.disconnect(user_id, socket)


def broadcast(manager: ConnectionManager, user_ids: Iterable[int], event: dict) -> None:
    """Send from a synchronous endpoint.

    FastAPI runs `def` endpoints in an anyio worker thread, so this hops back
    onto the event loop to do the actual sending. Keeping the endpoints
    synchronous means our blocking SQLAlchemy calls never sit on the loop.
    """
    ids = list(user_ids)
    if not ids:
        return
    anyio.from_thread.run(manager.send, ids, event)
