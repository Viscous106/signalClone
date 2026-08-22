import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConversationList } from "./ConversationList";
import type { Conversation, Message, UserBrief } from "@/lib/types";

// Forward every prop: the real Link does, and the test asserts on aria-current.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const ME = 1;
const person = (id: number, display_name: string): UserBrief => ({
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
const alice = person(1, "Alice Chen");
const bob = person(2, "Bob Martinez");
const carol = person(3, "Carol Nwosu");

const msg = (senderId: number, body: string): Message => ({
  id: 5,
  conversation_id: 1,
  sender_id: senderId,
  type: "text",
  body,
  created_at: new Date().toISOString(),
  sender: senderId === 2 ? bob : carol,
});

const conv = (over: Partial<Conversation> & { id: number }): Conversation => ({
  type: "direct",
  name: null,
  avatar_url: null,
  avatar_color: "#336BA3",
  avatar_fg: "#5C5C5C",
  created_by: 1,
  created_at: new Date().toISOString(),
  last_message_at: new Date().toISOString(),
  members: [alice, bob],
  last_message: null,
  unread_count: 0,
  ...over,
});

const withBob = conv({ id: 1, last_message: msg(2, "See you at seven") });
const withCarol = conv({ id: 2, members: [alice, carol], last_message: msg(3, "Design notes?") });
const group = conv({
  id: 3,
  type: "group",
  name: "Weekend Trip",
  members: [alice, bob, carol],
  last_message: msg(3, "I vote coast"),
  unread_count: 4,
});

const list = [group, withBob, withCarol];

describe("ConversationList", () => {
  it("keeps the order the server gave, which is newest activity first", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={null} query="" />);
    const titles = screen.getAllByTestId("conversation-title").map((n) => n.textContent);
    expect(titles).toEqual(["Weekend Trip", "Bob Martinez", "Carol Nwosu"]);
  });

  it("shows the last message preview", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={null} query="" />);
    expect(screen.getByText("See you at seven")).toBeInTheDocument();
    expect(screen.getByText("Carol: I vote coast")).toBeInTheDocument();
  });

  it("badges unread conversations only", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={null} query="" />);
    const badges = screen.getAllByTestId("unread-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("4");
  });

  it("filters on the search term, matching members as well as titles", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={null} query="carol" />);
    const titles = screen.getAllByTestId("conversation-title").map((n) => n.textContent);
    expect(titles).toEqual(["Weekend Trip", "Carol Nwosu"]);
  });

  it("explains an empty result rather than showing a blank pane", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={null} query="zebra" />);
    expect(screen.queryAllByTestId("conversation-title")).toHaveLength(0);
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("uses Signal's own wording when there are no chats at all", () => {
    render(<ConversationList conversations={[]} meId={ME} activeId={null} query="" />);
    expect(screen.getByText("No chats")).toBeInTheDocument();
    expect(screen.getByText(/recent chats will appear here/i)).toBeInTheDocument();
  });

  it("marks the open conversation as current for assistive tech", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={1} query="" />);
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("Bob Martinez");
  });

  it("links each row to its chat", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={null} query="" />);
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/chat/3");
  });
});
