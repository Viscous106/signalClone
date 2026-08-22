import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GroupInfoModal } from "./GroupInfoModal";
import type { Conversation, UserBrief } from "@/lib/types";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const person = (id: number, display_name: string): UserBrief => ({
  id,
  display_name,
  phone: `+1555000000${id}`,
  avatar_url: null,
  avatar_color: "#D8E8F0",
  about: null,
  last_seen_at: null,
  online: false,
});

const alice = person(1, "Alice Chen");
const bob = person(2, "Bob Martinez");
const carol = person(3, "Carol Nwosu");

const member = (u: UserBrief, role: "admin" | "member") => ({
  role,
  joined_at: "2026-08-22T09:00:00Z",
  last_read_message_id: 0,
  user: u,
});

const group: Conversation = {
  id: 7,
  type: "group",
  name: "Weekend Trip",
  avatar_url: null,
  avatar_color: "#D8E8F0",
  created_by: 1,
  created_at: "2026-08-22T09:00:00Z",
  last_message_at: "2026-08-22T10:00:00Z",
  members: [alice, bob, carol],
  last_message: null,
  unread_count: 0,
};

function mockApi(routes: Record<string, unknown>) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = url.toString();
      const method = init?.method ?? "GET";
      calls.push({ url: path, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const key =
        Object.keys(routes).find(
          (k) => k.startsWith(`${method} `) && path.includes(k.slice(method.length + 1))
        ) ?? Object.keys(routes).find((k) => !k.includes(" ") && path.includes(k));
      if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;
      return { ok: true, status: 200, json: async () => routes[key] } as Response;
    })
  );
  return calls;
}

const AS_ADMIN = { "GET /members": [member(alice, "admin"), member(bob, "member"), member(carol, "member")] };
const AS_MEMBER = { "GET /members": [member(alice, "admin"), member(bob, "member"), member(carol, "member")] };

describe("GroupInfoModal", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    replace.mockClear();
  });

  it("lists the members and marks the admin", async () => {
    mockApi(AS_ADMIN);
    render(<GroupInfoModal conversation={group} meId={1} onClose={vi.fn()} />);

    expect(await screen.findByText("Bob Martinez")).toBeInTheDocument();
    expect(screen.getAllByText(/admin/i).length).toBeGreaterThan(0);
  });

  it("shows the member count", async () => {
    mockApi(AS_ADMIN);
    render(<GroupInfoModal conversation={group} meId={1} onClose={vi.fn()} />);
    expect(await screen.findByText(/3 members/i)).toBeInTheDocument();
  });

  it("offers admin controls to an admin", async () => {
    mockApi(AS_ADMIN);
    render(<GroupInfoModal conversation={group} meId={1} onClose={vi.fn()} />);

    expect(await screen.findByRole("button", { name: /add members/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remove/i }).length).toBe(2);
  });

  it("hides admin controls from a plain member", async () => {
    mockApi(AS_MEMBER);
    render(<GroupInfoModal conversation={group} meId={2} onClose={vi.fn()} />);

    await screen.findByText("Carol Nwosu");
    expect(screen.queryByRole("button", { name: /add members/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /remove/i })).toHaveLength(0);
  });

  it("never offers to remove yourself — that is Leave", async () => {
    mockApi(AS_ADMIN);
    render(<GroupInfoModal conversation={group} meId={1} onClose={vi.fn()} />);

    await screen.findByText("Bob Martinez");
    const rows = screen.getAllByTestId("member-row");
    const mine = rows.find((r) => r.textContent?.includes("Alice Chen"));
    expect(mine?.querySelector("button")).toBeNull();
    expect(screen.getByRole("button", { name: /leave group/i })).toBeInTheDocument();
  });

  it("removes a member", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...AS_ADMIN, "DELETE /members/2": [] });
    render(<GroupInfoModal conversation={group} meId={1} onClose={vi.fn()} />);

    await screen.findByText("Bob Martinez");
    const rows = screen.getAllByTestId("member-row");
    const bobRow = rows.find((r) => r.textContent?.includes("Bob Martinez"))!;
    await user.click(bobRow.querySelector("button")!);

    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "DELETE" && c.url.includes("/members/2"))
      ).toBe(true)
    );
  });

  it("leaves the group and goes home", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...AS_ADMIN, "DELETE /members/1": [] });
    render(<GroupInfoModal conversation={group} meId={1} onClose={vi.fn()} />);

    await screen.findByText("Bob Martinez");
    await user.click(screen.getByRole("button", { name: /leave group/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/members/1"))).toBe(true);
  });

  it("lets an admin rename the group", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...AS_ADMIN, "PATCH /api/conversations/7": { ...group, name: "Coast" } });
    render(<GroupInfoModal conversation={group} meId={1} onClose={vi.fn()} />);

    await user.clear(await screen.findByLabelText(/group name/i));
    await user.type(screen.getByLabelText(/group name/i), "Coast");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(calls.some((c) => c.method === "PATCH" && c.body && (c.body as {name: string}).name === "Coast")).toBe(true)
    );
  });

  it("does not let a plain member rename it", async () => {
    mockApi(AS_MEMBER);
    render(<GroupInfoModal conversation={group} meId={2} onClose={vi.fn()} />);
    await screen.findByText("Carol Nwosu");
    expect(screen.queryByLabelText(/group name/i)).not.toBeInTheDocument();
  });
});
