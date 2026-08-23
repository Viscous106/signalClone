import { beforeEach, describe, expect, it } from "vitest";

import { useConversations } from "./conversations";
import type { Conversation, Message, UserBrief } from "@/lib/types";

const ME = 1;

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

const conv = (over: Partial<Conversation> & { id: number }): Conversation => ({
  type: "group",
  name: "Weekend Trip",
  avatar_url: null,
  avatar_color: "#D8E8F0",
  avatar_fg: "#5C5C5C",
  created_by: 1,
  created_at: "2026-08-22T09:00:00Z",
  last_message_at: "2026-08-22T10:00:00Z",
  members: [alice, bob],
  last_message: null,
  unread_count: 0,
  disappear_seconds: 0,
  ...over,
});

const msg = (over: Partial<Message> = {}): Message => ({
  id: 50,
  conversation_id: 1,
  sender_id: 2,
  type: "text",
  body: "the newest thing",
  created_at: "2026-08-22T11:00:00Z",
  ...over,
});

const seed = (items: Conversation[]) => useConversations.setState({ items, loading: false });

describe("conversations store", () => {
  beforeEach(() => seed([]));

  describe("applyMessage", () => {
    it("moves the conversation to the top and updates the preview", () => {
      seed([conv({ id: 1 }), conv({ id: 2, last_message_at: "2026-08-22T10:30:00Z" })]);
      useConversations.getState().applyMessage(msg(), ME);

      const items = useConversations.getState().items;
      expect(items[0].id).toBe(1);
      expect(items[0].last_message?.body).toBe("the newest thing");
    });

    it("badges a message from someone else", () => {
      seed([conv({ id: 1 })]);
      useConversations.getState().applyMessage(msg({ sender_id: 2 }), ME);
      expect(useConversations.getState().items[0].unread_count).toBe(1);
    });

    it("does not badge my own message", () => {
      seed([conv({ id: 1 })]);
      useConversations.getState().applyMessage(msg({ sender_id: ME }), ME);
      expect(useConversations.getState().items[0].unread_count).toBe(0);
    });
  });

  describe("applyUpdate", () => {
    it("takes the new name without discarding the preview or the badge", () => {
      // The broadcast is one payload for every member, so it cannot carry
      // per-person state: it always arrives with no last_message and no
      // unread count. Overwriting with it would blank the sidebar.
      seed([conv({ id: 1, last_message: msg(), unread_count: 3 })]);

      useConversations
        .getState()
        .applyUpdate(conv({ id: 1, name: "Coast Trip", last_message: null, unread_count: 0 }));

      const row = useConversations.getState().items[0];
      expect(row.name).toBe("Coast Trip");
      expect(row.last_message?.body).toBe("the newest thing");
      expect(row.unread_count).toBe(3);
    });

    it("picks up membership changes", () => {
      seed([conv({ id: 1 })]);
      const carol = person(3, "Carol Nwosu");
      useConversations.getState().applyUpdate(conv({ id: 1, members: [alice, bob, carol] }));
      expect(useConversations.getState().items[0].members).toHaveLength(3);
    });

    it("inserts a conversation I have just been added to", () => {
      seed([]);
      useConversations.getState().applyUpdate(conv({ id: 9, name: "Newly Added" }));
      expect(useConversations.getState().items.map((c) => c.id)).toEqual([9]);
    });
  });

  describe("remove", () => {
    it("drops a conversation I am no longer in", () => {
      seed([conv({ id: 1 }), conv({ id: 2 })]);
      useConversations.getState().remove(1);
      expect(useConversations.getState().items.map((c) => c.id)).toEqual([2]);
    });
  });

  describe("applyPresence", () => {
    it("updates that person everywhere they appear", () => {
      seed([conv({ id: 1 }), conv({ id: 2 })]);
      useConversations.getState().applyPresence(2, true);

      for (const row of useConversations.getState().items) {
        expect(row.members.find((m) => m.id === 2)?.online).toBe(true);
      }
    });

    it("leaves everyone else alone", () => {
      seed([conv({ id: 1 })]);
      useConversations.getState().applyPresence(2, true);
      expect(useConversations.getState().items[0].members.find((m) => m.id === 1)?.online).toBe(false);
    });
  });
});
