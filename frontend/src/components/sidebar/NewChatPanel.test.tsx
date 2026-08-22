import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewChatPanel } from "./NewChatPanel";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const person = (id: number, display_name: string) => ({
  id,
  display_name,
  phone: `+1555000000${id}`,
  avatar_url: null,
  avatar_color: "#336BA3",
  avatar_fg: "#5C5C5C",
  about: null,
  last_seen_at: null,
  online: false,
});

/**
 * Routes are matched on "METHOD path" first, then on path alone. GET and POST
 * /api/contacts are different endpoints and must be distinguishable.
 */
function mockApi(routes: Record<string, unknown>) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = url.toString();
      const method = init?.method ?? "GET";
      calls.push({
        url: path,
        method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      const key =
        Object.keys(routes).find((k) => k.startsWith(`${method} `) && path.includes(k.slice(method.length + 1))) ??
        Object.keys(routes).find((k) => !k.includes(" ") && path.includes(k));

      if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;

      const value = routes[key] as Record<string, unknown>;
      const status = typeof value === "object" && value && "__status" in value ? (value.__status as number) : 200;
      return {
        ok: status < 400,
        status,
        json: async () => (status < 400 ? value : { detail: value.detail ?? "Error" }),
      } as Response;
    })
  );
  return calls;
}

describe("NewChatPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    push.mockClear();
  });

  it("lists my contacts before I search anything", async () => {
    mockApi({ "/api/contacts": [person(2, "Bob Martinez"), person(3, "Carol Nwosu")] });
    render(<NewChatPanel onBack={vi.fn()} onNewGroup={vi.fn()} />);

    expect(await screen.findByText("Bob Martinez")).toBeInTheDocument();
    expect(screen.getByText("Carol Nwosu")).toBeInTheDocument();
  });

  it("shows each number, so two people with one name are distinguishable", async () => {
    // Both of these are called Lambda. Without the number there is no way to
    // tell which is which.
    mockApi({ "/api/contacts": [person(7, "Lambda"), person(8, "Lambda")] });
    render(<NewChatPanel onBack={vi.fn()} onNewGroup={vi.fn()} />);

    expect(await screen.findByText("+15550000007")).toBeInTheDocument();
    expect(screen.getByText("+15550000008")).toBeInTheDocument();
  });

  it("searches all users once I type", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "/api/contacts": [],
      "/api/users/search": [person(9, "Dave Kim")],
    });
    render(<NewChatPanel onBack={vi.fn()} onNewGroup={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/name, username, or number/i), "dave");

    expect(await screen.findByText("Dave Kim")).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/api/users/search?q=dave"))).toBe(true)
    );
  });

  it("starts a conversation and opens it", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "/api/contacts": [person(2, "Bob Martinez")],
      "/api/conversations": { id: 42, type: "direct" },
    });
    render(<NewChatPanel onBack={vi.fn()} onNewGroup={vi.fn()} />);

    await user.click(await screen.findByText("Bob Martinez"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/chat/42"));
    const created = calls.find((c) => c.method === "POST" && c.url.includes("/api/conversations"));
    expect(created?.body).toEqual({ user_id: 2 });
  });

  it("offers to add a number that is not yet a contact", async () => {
    const user = userEvent.setup();
    mockApi({ "/api/contacts": [], "/api/users/search": [] });
    render(<NewChatPanel onBack={vi.fn()} onNewGroup={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/name, username, or number/i), "+15559998888");

    expect(await screen.findByRole("button", { name: /add.*\+1/i })).toBeInTheDocument();
  });

  it("does not offer to add a search term that is not a phone number", async () => {
    const user = userEvent.setup();
    mockApi({ "/api/contacts": [], "/api/users/search": [] });
    render(<NewChatPanel onBack={vi.fn()} onNewGroup={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/name, username, or number/i), "zebra");

    await waitFor(() => expect(screen.getByText(/no one found/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^add/i })).not.toBeInTheDocument();
  });

  it("reports a number that is not on Signal", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/contacts": [],
      "/api/users/search": [],
      "POST /api/contacts": { __status: 404, detail: "That number is not on Signal" },
    });
    render(<NewChatPanel onBack={vi.fn()} onNewGroup={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/name, username, or number/i), "+15559998888");
    await user.click(await screen.findByRole("button", { name: /add.*\+1/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not on signal/i);
  });

  it("goes back to the list on the back chevron", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    mockApi({ "/api/contacts": [] });
    render(<NewChatPanel onBack={onBack} onNewGroup={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("offers the three shortcut rows the app shows", async () => {
    mockApi({ "/api/contacts": [] });
    render(<NewChatPanel onBack={vi.fn()} onNewGroup={vi.fn()} />);

    expect(await screen.findByText("New group")).toBeInTheDocument();
    expect(screen.getByText("Find by username")).toBeInTheDocument();
    expect(screen.getByText("Find by phone number")).toBeInTheDocument();
  });

  it("hands off to the group composer", async () => {
    const user = userEvent.setup();
    const onNewGroup = vi.fn();
    mockApi({ "/api/contacts": [] });
    render(<NewChatPanel onBack={vi.fn()} onNewGroup={onNewGroup} />);

    await user.click(await screen.findByText("New group"));
    expect(onNewGroup).toHaveBeenCalled();
  });
});
