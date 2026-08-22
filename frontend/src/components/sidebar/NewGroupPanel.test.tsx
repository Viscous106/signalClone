import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewGroupPanel } from "./NewGroupPanel";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const person = (id: number, display_name: string) => ({
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

const CONTACTS = [person(2, "Bob Martinez"), person(3, "Carol Nwosu"), person(4, "Dave Kim")];

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

const goToNaming = async (user: ReturnType<typeof userEvent.setup>, names: string[]) => {
  for (const name of names) {
    await user.click(await screen.findByText(name));
  }
  await user.click(screen.getByRole("button", { name: /next/i }));
};

describe("NewGroupPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    push.mockClear();
  });

  it("lists my contacts to choose from", async () => {
    mockApi({ "/api/contacts": CONTACTS });
    render(<NewGroupPanel onBack={vi.fn()} />);
    expect(await screen.findByText("Bob Martinez")).toBeInTheDocument();
    expect(screen.getByText("Dave Kim")).toBeInTheDocument();
  });

  it("will not continue with nobody selected", async () => {
    mockApi({ "/api/contacts": CONTACTS });
    render(<NewGroupPanel onBack={vi.fn()} />);
    await screen.findByText("Bob Martinez");
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("shows who is selected and counts them", async () => {
    const user = userEvent.setup();
    mockApi({ "/api/contacts": CONTACTS });
    render(<NewGroupPanel onBack={vi.fn()} />);

    await user.click(await screen.findByText("Bob Martinez"));
    await user.click(screen.getByText("Carol Nwosu"));

    expect(screen.getAllByTestId("selected-pill")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("lets me deselect someone", async () => {
    const user = userEvent.setup();
    mockApi({ "/api/contacts": CONTACTS });
    render(<NewGroupPanel onBack={vi.fn()} />);

    await user.click(await screen.findByText("Bob Martinez"));
    await user.click(screen.getByText("Bob Martinez"));

    expect(screen.queryAllByTestId("selected-pill")).toHaveLength(0);
  });

  it("asks for a name before creating anything", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "/api/contacts": CONTACTS });
    render(<NewGroupPanel onBack={vi.fn()} />);

    await goToNaming(user, ["Bob Martinez"]);

    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("will not create a group with a blank name", async () => {
    const user = userEvent.setup();
    mockApi({ "/api/contacts": CONTACTS });
    render(<NewGroupPanel onBack={vi.fn()} />);

    await goToNaming(user, ["Bob Martinez"]);
    await user.type(screen.getByLabelText(/group name/i), "   ");

    expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
  });

  it("creates the group and opens it", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "/api/contacts": CONTACTS,
      "POST /api/conversations": { id: 77, type: "group", name: "Weekend Trip" },
    });
    render(<NewGroupPanel onBack={vi.fn()} />);

    await goToNaming(user, ["Bob Martinez", "Carol Nwosu"]);
    await user.type(screen.getByLabelText(/group name/i), "Weekend Trip");
    await user.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/chat/77"));
    const created = calls.find((c) => c.method === "POST");
    expect(created?.body).toEqual({ name: "Weekend Trip", member_ids: [2, 3] });
  });

  it("can go back to change the members", async () => {
    const user = userEvent.setup();
    mockApi({ "/api/contacts": CONTACTS });
    render(<NewGroupPanel onBack={vi.fn()} />);

    await goToNaming(user, ["Bob Martinez"]);
    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByText("Carol Nwosu")).toBeInTheDocument();
    expect(screen.getAllByTestId("selected-pill")).toHaveLength(1);
  });
});
