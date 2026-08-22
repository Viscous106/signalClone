import { create } from "zustand";

import { api } from "@/lib/api";
import type { Conversation, Message } from "@/lib/types";

type ConversationState = {
  items: Conversation[];
  loading: boolean;
  load: () => Promise<void>;
  upsert: (conversation: Conversation) => void;
  applyMessage: (message: Message, meId: number) => void;
  applyUpdate: (conversation: Conversation) => void;
  applyPresence: (userId: number, online: boolean, lastSeenAt?: string) => void;
  clearUnread: (conversationId: number) => void;
  remove: (conversationId: number) => void;
};

export const useConversations = create<ConversationState>((set, get) => ({
  items: [],
  loading: true,

  load: async () => {
    try {
      const items = await api.get<Conversation[]>("/api/conversations");
      set({ items, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  /** Insert or replace one row, keeping newest-activity-first order. */
  upsert: (conversation) => {
    const rest = get().items.filter((c) => c.id !== conversation.id);
    const items = [conversation, ...rest].sort(
      (a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at)
    );
    set({ items });
  },

  /**
   * A live message updates the sidebar: new preview, new sort position, and a
   * badge unless I sent it.
   */
  applyMessage: (message, meId) => {
    const items = get()
      .items.map((conversation) =>
        conversation.id === message.conversation_id
          ? {
              ...conversation,
              last_message: message,
              last_message_at: message.created_at,
              unread_count:
                message.sender_id === meId
                  ? conversation.unread_count
                  : conversation.unread_count + 1,
            }
          : conversation
      )
      .sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at));
    set({ items });
  },

  /**
   * A conversation's shape changed — renamed, or members added or removed.
   *
   * The broadcast is one payload for every member, so it cannot carry
   * per-person state: it always arrives with `last_message: null` and
   * `unread_count: 0`. Taking it wholesale would blank the sidebar for
   * everyone, so structural fields are merged over whatever we already hold.
   */
  applyUpdate: (conversation) => {
    const existing = get().items.find((c) => c.id === conversation.id);
    if (!existing) {
      // Newly added to a group: keep it, and the system message that follows
      // will fill in the preview.
      get().upsert(conversation);
      return;
    }
    const merged = {
      ...existing,
      name: conversation.name,
      avatar_url: conversation.avatar_url,
      avatar_color: conversation.avatar_color,
      members: conversation.members,
    };
    set({ items: get().items.map((c) => (c.id === merged.id ? merged : c)) });
  },

  applyPresence: (userId, online, lastSeenAt) => {
    set({
      items: get().items.map((conversation) => ({
        ...conversation,
        members: conversation.members.map((member) =>
          member.id === userId
            ? { ...member, online, last_seen_at: lastSeenAt ?? member.last_seen_at }
            : member
        ),
      })),
    });
  },

  /** Drop a conversation I am no longer in. */
  remove: (conversationId) => {
    set({ items: get().items.filter((c) => c.id !== conversationId) });
  },

  clearUnread: (conversationId) => {
    set({
      items: get().items.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation
      ),
    });
  },
}));
