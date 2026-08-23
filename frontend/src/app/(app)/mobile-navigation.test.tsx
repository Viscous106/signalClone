import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AppLayout from "./layout";
import ChatPage from "./chat/page";
import type { Conversation, User, UserBrief } from "@/lib/types";
import { useConversations } from "@/store/conversations";
import { useMessages } from "@/store/messages";
import { useSession } from "@/store/session";

/** A router that actually moves, so a click changes what renders. */
let pathname = "/";
let search = "";
const push = vi.fn((href: string) => {
  const [p, q = ""] = href.split("?");
  pathname = p;
  search = q;
});
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, replace: push }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        e.preventDefault();
        push(href);
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/useRealtime", () => ({ useRealtime: () => undefined, sendTyping: vi.fn() }));

const person = (id: number, display_name: string): UserBrief => ({
  id,
  display_name,
  phone: `+1555000000${id}`,
  avatar_url: null,
  avatar_color: "#D8E8F0",
  avatar_fg: "#086DA0",
  about: null,
  last_seen_at: null,
  online: false,
});

const ME: User = {
  id: 1,
  phone: "+15550000001",
  username: null,
  display_name: "Alice Chen",
  avatar_url: null,
  avatar_color: "#D8E8F0",
  avatar_fg: "#086DA0",
  about: null,
  last_seen_at: null,
  created_at: "2026-08-22T09:00:00Z",
};

const bob = person(2, "Bob Martinez");

const conversation: Conversation = {
  id: 7,
  type: "direct",
  name: null,
  avatar_url: null,
  avatar_color: "#D8E8F0",
  avatar_fg: "#086DA0",
  created_by: 1,
  created_at: "2026-08-22T09:00:00Z",
  last_message_at: "2026-08-22T10:00:00Z",
  members: [person(1, "Alice Chen"), bob],
  last_message: null,
  unread_count: 0,
  disappear_seconds: 0,
};

describe("opening a conversation", () => {
  beforeEach(() => {
    pathname = "/";
    search = "";
    push.mockClear();
    useSession.setState({ user: ME });
    useConversations.setState({ items: [conversation], loading: false });
    useMessages.setState({ byConversation: {}, typingBy: {}, loaded: {} });
    // Route by URL: the sidebar loads the list on mount, and a blanket mock
    // would overwrite the conversation this test is about.
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      const path = url.toString();
      const body = path.includes("/messages")
        ? []
        : /\/api\/conversations\/\d+$/.test(path)
          ? conversation
          : path.includes("/api/conversations")
            ? [conversation]
            : [];
      return { ok: true, status: 200, json: async () => body } as Response;
    }));
  });

  it("links the row to the conversation", () => {
    render(
      <AppLayout>
        <ChatPage />
      </AppLayout>
    );
    expect(screen.getByRole("link", { name: /Bob Martinez/ })).toHaveAttribute(
      "href",
      "/chat?c=7"
    );
  });

  it("navigates when the row is tapped", async () => {
    const user = userEvent.setup();
    render(
      <AppLayout>
        <ChatPage />
      </AppLayout>
    );

    await user.click(screen.getByRole("link", { name: /Bob Martinez/ }));
    expect(push).toHaveBeenCalledWith("/chat?c=7");
  });

  it("renders the thread once the route has changed", async () => {
    pathname = "/chat";
    search = "c=7";
    render(
      <AppLayout>
        <ChatPage />
      </AppLayout>
    );

    // The composer only exists inside an open conversation.
    await waitFor(() => expect(screen.getByLabelText("Message")).toBeInTheDocument());
    // The sidebar stays mounted behind CSS, so scope to the chat header.
    const header = screen.getByRole("banner", { name: "Conversation" });
    expect(within(header).getByText("Bob Martinez")).toBeInTheDocument();
  });

  it("shows the pane and hides the list on a phone", async () => {
    pathname = "/chat";
    search = "c=7";
    const { container } = render(
      <AppLayout>
        <ChatPage />
      </AppLayout>
    );

    await waitFor(() => expect(screen.getByLabelText("Message")).toBeInTheDocument());
    const section = container.querySelector("section")!;
    expect(section.className).toContain("flex");
    expect(section.className).not.toContain("hidden");
  });

  it("offers a way back to the list", async () => {
    pathname = "/chat";
    search = "c=7";
    render(
      <AppLayout>
        <ChatPage />
      </AppLayout>
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /back to chats/i })).toHaveAttribute("href", "/")
    );
  });

  it("fetches the conversation when deep-linked and the list has not loaded", async () => {
    pathname = "/chat";
    search = "c=99";
    useConversations.setState({ items: [], loading: false });
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const path = url.toString();
        calls.push(path);
        const body = path.includes("/messages")
          ? []
          : /\/api\/conversations\/\d+$/.test(path)
            ? { ...conversation, id: 99 }
            : [];
        return { ok: true, status: 200, json: async () => body } as Response;
      })
    );

    render(
      <AppLayout>
        <ChatPage />
      </AppLayout>
    );

    await waitFor(() =>
      expect(calls.some((c) => c.includes("/api/conversations/99"))).toBe(true)
    );
  });
});
