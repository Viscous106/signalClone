"""Shared test actors.

All actors share ONE TestClient. Each TestClient runs its own event loop, and
the WebSocket connection manager would then be awaiting sockets belonging to a
different loop — which deadlocks. Production has a single loop, so identity is
carried per request via the Cookie header instead.
"""

OTP = "123456"


class Actor:
    """One signed-in person, acting through the shared client."""

    def __init__(self, client, user, token):
        self.client = client
        self.user = user
        self._headers = {"Cookie": f"session={token}"}

    @property
    def id(self) -> int:
        return self.user["id"]

    @property
    def name(self) -> str:
        return self.user["display_name"]

    def post(self, url, **kwargs):
        return self.client.post(url, headers=self._headers, **kwargs)

    def get(self, url, **kwargs):
        return self.client.get(url, headers=self._headers, **kwargs)

    def patch(self, url, **kwargs):
        return self.client.patch(url, headers=self._headers, **kwargs)

    def delete(self, url, **kwargs):
        return self.client.delete(url, headers=self._headers, **kwargs)

    def ws(self):
        return self.client.websocket_connect("/ws", headers=self._headers)


def sign_in(client, phone: str, name: str | None = None) -> Actor:
    body = {"phone": phone, "code": OTP}
    if name:
        body["display_name"] = name
    response = client.post("/api/auth/verify", json=body)
    assert response.status_code == 200, response.text
    token = response.cookies["session"]
    # Keep the jar empty so no request inherits an identity by accident.
    client.cookies.clear()
    return Actor(client, response.json(), token)
