import { describe, expect, it } from "vitest";

import { conversationTitle, matchesSearch, otherMember, previewText } from "./conversation";
import type { Conversation, Message, UserBrief } from "./types";

const ME = 1;

const person = (id: number, display_name: string, extra: Partial<UserBrief> = {}): UserBrief => ({
  id,
  display_name,
  phone: `+1555000000${id}`,
  avatar_url: null,
  avatar_color: "#336BA3",
  about: null,
  last_seen_at: null,
  online: false,
  ...extra,
});

const alice = person(1, "Alice Chen");
const bob = person(2, "Bob Martinez");
const carol = person(3, "Carol Nwosu");

const message = (senderId: number | null, body: string, type: "text" | "system" = "text"): Message => ({
  id: 10,
  conversation_id: 1,
  sender_id: senderId,
  type,
  body,
  created_at: "2026-08-22T10:00:00Z",
  sender: senderId === null ? null : [alice, bob, carol].find((p) => p.id === senderId) ?? null,
});

const conversation = (over: Partial<Conversation> = {}): Conversation => ({
  id: 1,
  type: "direct",
  name: null,
  avatar_url: null,
  avatar_color: "#336BA3",
  created_by: 1,
  created_at: "2026-08-22T09:00:00Z",
  last_message_at: "2026-08-22T10:00:00Z",
  members: [alice, bob],
  last_message: null,
  unread_count: 0,
  ...over,
});

describe("otherMember", () => {
  it("is the counterpart in a direct chat", () => {
    expect(otherMember(conversation(), ME)?.display_name).toBe("Bob Martinez");
  });

  it("is null for a group, which has no single counterpart", () => {
    const group = conversation({ type: "group", name: "Trip", members: [alice, bob, carol] });
    expect(otherMember(group, ME)).toBeNull();
  });

  it("survives a chat with only me in it", () => {
    expect(otherMember(conversation({ members: [alice] }), ME)).toBeNull();
  });
});

describe("conversationTitle", () => {
  it("uses the other person's name for a direct chat", () => {
    expect(conversationTitle(conversation(), ME)).toBe("Bob Martinez");
  });

  it("uses the group name for a group", () => {
    const group = conversation({ type: "group", name: "Weekend Trip", members: [alice, bob] });
    expect(conversationTitle(group, ME)).toBe("Weekend Trip");
  });

  it("falls back for an unnamed group rather than showing nothing", () => {
    const group = conversation({ type: "group", name: null, members: [alice, bob, carol] });
    expect(conversationTitle(group, ME)).toBe("Bob Martinez, Carol Nwosu");
  });
});

describe("previewText — the second line of a sidebar row", () => {
  it("is empty when nothing has been said", () => {
    expect(previewText(conversation(), ME)).toBe("");
  });

  it("shows the message alone when the other person sent it", () => {
    const c = conversation({ last_message: message(2, "See you at seven") });
    expect(previewText(c, ME)).toBe("See you at seven");
  });

  it("prefixes my own messages with You:", () => {
    const c = conversation({ last_message: message(1, "On my way") });
    expect(previewText(c, ME)).toBe("You: On my way");
  });

  it("names the sender in a group, as Signal does", () => {
    const c = conversation({
      type: "group",
      name: "Trip",
      members: [alice, bob, carol],
      last_message: message(3, "I vote coast"),
    });
    expect(previewText(c, ME)).toBe("Carol: I vote coast");
  });

  it("still says You: in a group", () => {
    const c = conversation({
      type: "group",
      name: "Trip",
      members: [alice, bob, carol],
      last_message: message(1, "Booked it"),
    });
    expect(previewText(c, ME)).toBe("You: Booked it");
  });

  it("shows system messages plainly, with no sender prefix", () => {
    const c = conversation({
      type: "group",
      name: "Trip",
      last_message: message(null, "Alice added Bob", "system"),
    });
    expect(previewText(c, ME)).toBe("Alice added Bob");
  });

  it("reports a deleted message instead of a blank line", () => {
    const deleted = { ...message(2, ""), deleted_at: "2026-08-22T10:05:00Z" };
    expect(previewText(conversation({ last_message: deleted }), ME)).toMatch(/deleted/i);
  });
});

describe("matchesSearch — filtering the sidebar", () => {
  const group = conversation({ type: "group", name: "Weekend Trip", members: [alice, bob, carol] });

  it("matches an empty query so the full list shows", () => {
    expect(matchesSearch(conversation(), ME, "")).toBe(true);
  });

  it("matches on title, case insensitively", () => {
    expect(matchesSearch(group, ME, "weekend")).toBe(true);
    expect(matchesSearch(group, ME, "WEEKEND")).toBe(true);
  });

  it("matches a member's name even when the title does not", () => {
    expect(matchesSearch(group, ME, "carol")).toBe(true);
  });

  it("never matches on my own name — every chat would match", () => {
    expect(matchesSearch(group, ME, "Alice")).toBe(false);
  });

  it("rejects a term that appears nowhere", () => {
    expect(matchesSearch(group, ME, "zebra")).toBe(false);
  });
});
