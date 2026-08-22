import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadCurrentUser } from "./session";

type Handler = { status: number; body: unknown };

function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string | URL) => {
    const path = url.toString();
    const key = Object.keys(routes).find((k) => path.includes(k));
    if (!key) throw new Error(`unmocked: ${path}`);
    const { status, body } = routes[key];
    return { ok: status < 400, status, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const calledLogout = (m: ReturnType<typeof mockApi>) =>
  m.mock.calls.some((c) => String(c[0]).includes("/auth/logout"));

describe("loadCurrentUser", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns the user when the session is good", async () => {
    const fetchMock = mockApi({
      "/users/me": { status: 200, body: { id: 1, display_name: "Alice" } },
    });
    await expect(loadCurrentUser()).resolves.toMatchObject({ display_name: "Alice" });
    expect(calledLogout(fetchMock)).toBe(false);
  });

  it("clears a stale cookie on 401 so the guard stops bouncing us", async () => {
    // The cookie is httpOnly, so only the server can remove it. Without this
    // the proxy keeps admitting us to / while /login redirects back to / —
    // an infinite loop. Reproduced against a deleted account.
    const fetchMock = mockApi({
      "/users/me": { status: 401, body: { detail: "Not authenticated" } },
      "/auth/logout": { status: 200, body: { ok: true } },
    });

    await expect(loadCurrentUser()).resolves.toBeNull();
    expect(calledLogout(fetchMock)).toBe(true);
  });

  it("keeps the cookie when the server merely errors", async () => {
    // A 500 says nothing about whether the session is valid; throwing the
    // user out would be wrong.
    const fetchMock = mockApi({ "/users/me": { status: 500, body: {} } });

    await expect(loadCurrentUser()).resolves.toBeNull();
    expect(calledLogout(fetchMock)).toBe(false);
  });

  it("still resolves if clearing the cookie itself fails", async () => {
    const fetchMock = mockApi({
      "/users/me": { status: 401, body: {} },
      "/auth/logout": { status: 500, body: {} },
    });
    await expect(loadCurrentUser()).resolves.toBeNull();
    expect(calledLogout(fetchMock)).toBe(true);
  });
});
