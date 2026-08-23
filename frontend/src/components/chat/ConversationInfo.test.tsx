import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationInfo } from "./ConversationInfo";
import { useToasts } from "@/store/toasts";
import type { Conversation, UserBrief } from "@/lib/types";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const person = (id: number, display_name: string): UserBrief => ({
  id,
  display_name,
  phone: `+1555000000${id}`,
  avatar_url: null,
  avatar_color: "#D8E8F0",
  avatar_fg: "#5C5C5C",
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
  avatar_fg: "#5C5C5C",
  created_by: 1,
  created_at: "2026-08-22T09:00:00Z",
  last_message_at: "2026-08-22T10:00:00Z",
  members: [alice, bob, carol],
  last_message: null,
  unread_count: 0,
  disappear_seconds: 0,
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

describe("ConversationInfo — a group", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    replace.mockClear();
    useToasts.setState({ items: [] });
  });

  it("lists the members and marks the admin", async () => {
    mockApi(AS_ADMIN);
    render(<ConversationInfo conversation={group} meId={1} onBack={vi.fn()} />);

    expect(await screen.findByText("Bob Martinez")).toBeInTheDocument();
    expect(screen.getAllByText(/admin/i).length).toBeGreaterThan(0);
  });

  it("shows the member count", async () => {
    mockApi(AS_ADMIN);
    render(<ConversationInfo conversation={group} meId={1} onBack={vi.fn()} />);
    expect(await screen.findByText(/3 members/i)).toBeInTheDocument();
  });

  it("offers admin controls to an admin", async () => {
    mockApi(AS_ADMIN);
    render(<ConversationInfo conversation={group} meId={1} onBack={vi.fn()} />);

    expect(await screen.findByRole("button", { name: /add members/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remove/i }).length).toBe(2);
    expect(screen.queryByTestId("admin-only-note")).not.toBeInTheDocument();
  });

  it("hides admin controls from a plain member", async () => {
    mockApi(AS_MEMBER);
    render(<ConversationInfo conversation={group} meId={2} onBack={vi.fn()} />);

    await screen.findByText("Carol Nwosu");
    expect(screen.queryByRole("button", { name: /add members/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /remove/i })).toHaveLength(0);
    // The absence needs a reason, or it reads as a broken screen.
    expect(screen.getByTestId("admin-only-note")).toHaveTextContent(/only admins/i);
  });

  it("never offers to remove yourself — that is Leave", async () => {
    mockApi(AS_ADMIN);
    render(<ConversationInfo conversation={group} meId={1} onBack={vi.fn()} />);

    await screen.findByText("Bob Martinez");
    const rows = screen.getAllByTestId("member-row");
    const mine = rows.find((r) => r.textContent?.includes("Alice Chen"));
    expect(mine?.querySelector("button")).toBeNull();
    expect(screen.getByRole("button", { name: /leave group/i })).toBeInTheDocument();
  });

  it("removes a member", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...AS_ADMIN, "DELETE /members/2": [] });
    render(<ConversationInfo conversation={group} meId={1} onBack={vi.fn()} />);

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
    render(<ConversationInfo conversation={group} meId={1} onBack={vi.fn()} />);

    await screen.findByText("Bob Martinez");
    await user.click(screen.getByRole("button", { name: /leave group/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/members/1"))).toBe(true);
  });

  it("lets an admin rename the group", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ ...AS_ADMIN, "PATCH /api/conversations/7": { ...group, name: "Coast" } });
    render(<ConversationInfo conversation={group} meId={1} onBack={vi.fn()} />);

    await user.clear(await screen.findByLabelText(/group name/i));
    await user.type(screen.getByLabelText(/group name/i), "Coast");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(calls.some((c) => c.method === "PATCH" && c.body && (c.body as {name: string}).name === "Coast")).toBe(true)
    );
  });

  it("confirms a rename with a toast", async () => {
    const user = userEvent.setup();
    mockApi({ ...AS_ADMIN, "PATCH /api/conversations/7": { ...group, name: "Coast" } });
    render(<ConversationInfo conversation={group} meId={1} onBack={vi.fn()} />);

    await user.clear(await screen.findByLabelText(/group name/i));
    await user.type(screen.getByLabelText(/group name/i), "Coast");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(useToasts.getState().items.map((t) => t.message)).toContain("Group renamed")
    );
  });

  it("says who was removed", async () => {
    const user = userEvent.setup();
    mockApi({ ...AS_ADMIN, "DELETE /members/2": [] });
    render(<ConversationInfo conversation={group} meId={1} onBack={vi.fn()} />);

    await screen.findByText("Bob Martinez");
    const bobRow = screen
      .getAllByTestId("member-row")
      .find((r) => r.textContent?.includes("Bob Martinez"))!;
    await user.click(bobRow.querySelector("button")!);

    await waitFor(() =>
      expect(useToasts.getState().items.map((t) => t.message)).toContain("Removed Bob Martinez")
    );
  });

  it("does not let a plain member rename it", async () => {
    mockApi(AS_MEMBER);
    render(<ConversationInfo conversation={group} meId={2} onBack={vi.fn()} />);
    await screen.findByText("Carol Nwosu");
    expect(screen.queryByLabelText(/group name/i)).not.toBeInTheDocument();
  });
});

const direct: Conversation = {
  ...group,
  id: 9,
  type: "direct",
  name: null,
  members: [alice, bob],
};

describe("ConversationInfo — the settings rows", () => {
  beforeEach(() => {
    useToasts.setState({ items: [] });
    localStorage.clear();
  });

  it("names a direct chat after the other person", () => {
    mockApi({});
    render(<ConversationInfo conversation={direct} meId={1} onBack={vi.fn()} />);
    expect(screen.getByText("Bob Martinez")).toBeInTheDocument();
  });

  it("shows the timer dropdown set to the conversation's value", () => {
    mockApi({});
    render(
      <ConversationInfo
        conversation={{ ...direct, disappear_seconds: 3600 }}
        meId={1}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Disappearing messages timer")).toHaveValue("3600");
  });

  it("says the clock starts when a message has been seen", () => {
    mockApi({});
    render(<ConversationInfo conversation={direct} meId={1} onBack={vi.fn()} />);
    expect(screen.getByText(/disappear after they've been seen/i)).toBeInTheDocument();
  });

  it("sends the chosen duration to the API", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "PATCH /disappearing": { ...direct, disappear_seconds: 300 } });
    render(<ConversationInfo conversation={direct} meId={1} onBack={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Disappearing messages timer"), "300");
    await waitFor(() =>
      expect(
        calls.some((c) => c.url.includes("/disappearing") && (c.body as { seconds: number })?.seconds === 300)
      ).toBe(true)
    );
  });

  it("lets either side set the timer in a direct chat", () => {
    mockApi({});
    render(<ConversationInfo conversation={direct} meId={2} onBack={vi.fn()} />);
    // No admins in a 1:1, so nobody is locked out.
    expect(screen.getByLabelText("Disappearing messages timer")).toBeEnabled();
  });

  it("locks the timer for a plain member of a group", async () => {
    mockApi(AS_MEMBER);
    render(<ConversationInfo conversation={group} meId={2} onBack={vi.fn()} />);

    await screen.findByText("Carol Nwosu");
    expect(screen.getByLabelText("Disappearing messages timer")).toBeDisabled();
    expect(screen.getByText(/only admins can change the timer/i)).toBeInTheDocument();
  });

  it("leaves the timer open to a group admin", async () => {
    mockApi(AS_ADMIN);
    render(<ConversationInfo conversation={group} meId={1} onBack={vi.fn()} />);

    await screen.findByText("Bob Martinez");
    expect(screen.getByLabelText("Disappearing messages timer")).toBeEnabled();
  });

  it("does not fetch a roster for a direct chat, which has none", () => {
    const calls = mockApi({});
    render(<ConversationInfo conversation={direct} meId={1} onBack={vi.fn()} />);
    expect(calls.some((c) => c.url.includes("/members"))).toBe(false);
  });

  it("offers mute and in-chat search but marks them unbuilt", () => {
    mockApi({});
    render(<ConversationInfo conversation={direct} meId={1} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /mute \(coming soon\)/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /search \(coming soon\)/i })).toBeDisabled();
  });

  it("goes back to the thread", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    mockApi({});
    render(<ConversationInfo conversation={direct} meId={1} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: "Back to conversation" }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe("ConversationInfo — chat color", () => {
  beforeEach(() => {
    localStorage.clear();
    mockApi({});
  });

  it("starts on Signal's default blue", () => {
    render(<ConversationInfo conversation={direct} meId={1} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /chat color: ultramarine/i })).toBeInTheDocument();
  });

  it("opens the palette and applies a pick", async () => {
    const user = userEvent.setup();
    render(<ConversationInfo conversation={direct} meId={1} onBack={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /chat color:/i }));
    await user.click(screen.getByRole("radio", { name: "Crimson" }));

    expect(screen.getByRole("button", { name: /chat color: crimson/i })).toBeInTheDocument();
  });

  it("keeps the choice per conversation", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ConversationInfo conversation={direct} meId={1} onBack={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /chat color:/i }));
    await user.click(screen.getByRole("radio", { name: "Teal" }));
    unmount();

    // A different thread is untouched by the first one's colour.
    render(<ConversationInfo conversation={{ ...direct, id: 42 }} meId={1} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /chat color: ultramarine/i })).toBeInTheDocument();
  });
});
