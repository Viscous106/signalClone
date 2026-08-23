import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChatPage from "./page";
import type { Conversation, UserBrief } from "@/lib/types";
import { useConversations } from "@/store/conversations";
import { useMessages } from "@/store/messages";
import { useSession } from "@/store/session";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("c=3"),
}));
vi.mock("@/hooks/useRealtime", () => ({ sendTyping: vi.fn() }));

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

const me = person(1, "Alice Chen");
const bob = person(2, "Bob Martinez");

const conversation: Conversation = {
  id: 3,
  type: "direct",
  name: null,
  avatar_url: null,
  avatar_color: "#D8E8F0",
  avatar_fg: "#086DA0",
  created_by: 1,
  created_at: "2026-08-22T09:00:00Z",
  last_message_at: "2026-08-22T10:00:00Z",
  members: [me, bob],
  last_message: null,
  unread_count: 0,
  disappear_seconds: 0,
};

let errors: string[] = [];

describe("ChatPage", () => {
  beforeEach(() => {
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.map(String).join(" "));
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as unknown as Response)
    );
    useSession.setState({
      user: {
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
      },
    });
    useConversations.setState({ items: [conversation], loading: false });
    useMessages.setState({ byConversation: {}, typingBy: {}, loaded: {} });
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders the thread without React complaining about snapshots", async () => {
    // The reported bug: a selector doing `?? []` returned a new array on every
    // call, so React warned "The result of getSnapshot should be cached to
    // avoid an infinite loop" and the page spun.
    render(<ChatPage />);

    await waitFor(() => expect(screen.getByLabelText("Message")).toBeInTheDocument());

    const snapshotWarnings = errors.filter((line) => /getSnapshot|infinite loop/i.test(line));
    expect(snapshotWarnings).toEqual([]);
  });

  it("shows the other person in the header", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(screen.getByText("Bob Martinez")).toBeInTheDocument());
  });

  it("settles instead of re-rendering forever when nobody is typing", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(screen.getByLabelText("Message")).toBeInTheDocument());

    // A runaway loop shows up as React's update-depth error.
    expect(errors.filter((l) => /Maximum update depth/i.test(l))).toEqual([]);
  });

  it("renders a typing indicator when someone is typing", async () => {
    render(<ChatPage />);
    await waitFor(() => expect(screen.getByLabelText("Message")).toBeInTheDocument());

    useMessages.getState().setTyping(3, bob.id, true);

    await waitFor(() => expect(screen.getByText(/is typing/i)).toBeInTheDocument());
    expect(errors.filter((l) => /getSnapshot|infinite loop/i.test(l))).toEqual([]);
  });
});
