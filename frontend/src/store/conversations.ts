import { create } from "zustand";

import { api } from "@/lib/api";
import type { Conversation } from "@/lib/types";

type ConversationState = {
  items: Conversation[];
  loading: boolean;
  load: () => Promise<void>;
  upsert: (conversation: Conversation) => void;
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
}));
