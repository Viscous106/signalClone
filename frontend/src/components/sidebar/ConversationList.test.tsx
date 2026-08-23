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

  it("can show only what is unread", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={null} query="" filter="unread" />);
    const titles = screen.getAllByTestId("conversation-title").map((n) => n.textContent);
    // Only the group carries a badge in this fixture.
    expect(titles).toEqual(["Weekend Trip"]);
  });

  it("says you are caught up when nothing is unread", () => {
    render(
      <ConversationList conversations={[withBob]} meId={ME} activeId={null} query="" filter="unread" />
    );
    expect(screen.getByText(/no unread chats/i)).toBeInTheDocument();
  });

  it("shows only groups under the Groups chip", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={null} query="" filter="groups" />);
    const titles = screen.getAllByTestId("conversation-title").map((n) => n.textContent);
    expect(titles).toEqual(["Weekend Trip"]);
  });

  it("shows only starred chats under the Favorites chip", () => {
    render(
      <ConversationList
        conversations={list}
        meId={ME}
        activeId={null}
        query=""
        filter="favorites"
        favoriteIds={[2]}
      />
    );
    const titles = screen.getAllByTestId("conversation-title").map((n) => n.textContent);
    expect(titles).toEqual(["Carol Nwosu"]);
  });

  it("points at the star when nothing is favourited yet", () => {
    render(
      <ConversationList conversations={list} meId={ME} activeId={null} query="" filter="favorites" />
    );
    expect(screen.getByText(/no favorites/i)).toBeInTheDocument();
    expect(screen.getByText(/star a chat/i)).toBeInTheDocument();
  });

  it("lets a search term explain the emptiness instead of the chip", () => {
    render(
      <ConversationList
        conversations={list}
        meId={ME}
        activeId={null}
        query="zebra"
        filter="groups"
      />
    );
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it("combines the filter with the search term", () => {
    render(
      <ConversationList conversations={list} meId={ME} activeId={null} query="bob" filter="unread" />
    );
    // "bob" matches his direct chat *and* the group he is a member of, but his
    // direct chat has nothing unread, so only the group survives both.
    const titles = screen.getAllByTestId("conversation-title").map((n) => n.textContent);
    expect(titles).toEqual(["Weekend Trip"]);
  });

  it("marks the open conversation as current for assistive tech", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={1} query="" />);
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("Bob Martinez");
  });

  it("links each row to its chat", () => {
    render(<ConversationList conversations={list} meId={ME} activeId={null} query="" />);
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/chat?c=3");
  });
});
