import { create } from "zustand";

import { api } from "@/lib/api";
import type { Conversation, Message } from "@/lib/types";

type ConversationState = {
  items: Conversation[];
  loading: boolean;
  load: () => Promise<void>;
  upsert: (conversation: Conversation) => void;
  applyMessage: (message: Message, meId: number) => void;
  applyPresence: (userId: number, online: boolean, lastSeenAt?: string) => void;
  clearUnread: (conversationId: number) => void;
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

  clearUnread: (conversationId) => {
    set({
      items: get().items.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation
      ),
    });
  },
}));
