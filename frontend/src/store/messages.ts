import { create } from "zustand";

import { api } from "@/lib/api";
import { useToasts } from "@/store/toasts";
import type { Message, MessageStatus } from "@/lib/types";

export type MessagesState = {
  /** Oldest first, per conversation. */
  byConversation: Record<number, Message[]>;
  /** Who is currently typing, per conversation. */
  typingBy: Record<number, number[]>;
  loaded: Record<number, boolean>;

  load: (conversationId: number) => Promise<void>;
  send: (conversationId: number, body: string, meId: number) => Promise<void>;
  applyNew: (message: Message) => void;
  applyStatus: (conversationId: number, messageId: number, status: MessageStatus) => void;
  setTyping: (conversationId: number, userId: number, isTyping: boolean) => void;
  markRead: (conversationId: number) => Promise<void>;
};

const byId = (a: Message, b: Message) => a.id - b.id;

/**
 * One shared empty array for "nobody is typing".
 *
 * A selector that does `?? []` returns a fresh array on every call, which makes
 * React's snapshot comparison fail forever: "The result of getSnapshot should
 * be cached to avoid an infinite loop."
 */
const NO_TYPISTS: number[] = [];

export const selectTyping =
  (conversationId: number) =>
  (state: MessagesState): number[] =>
    state.typingBy[conversationId] ?? NO_TYPISTS;

export const useMessages = create<MessagesState>((set, get) => ({
  byConversation: {},
  typingBy: {},
  loaded: {},

  load: async (conversationId) => {
    // The API returns newest first for pagination; the pane wants oldest first.
    const page = await api.get<Message[]>(`/api/conversations/${conversationId}/messages`);
    set((state) => ({
      byConversation: { ...state.byConversation, [conversationId]: [...page].reverse() },
      loaded: { ...state.loaded, [conversationId]: true },
    }));
  },

  send: async (conversationId, body, meId) => {
    const clientId = crypto.randomUUID();
    const optimistic: Message = {
      // Negative so it cannot collide with a real id, and still sorts last.
      id: Number.MAX_SAFE_INTEGER,
      local_id: clientId,
      conversation_id: conversationId,
      sender_id: meId,
      type: "text",
      body,
      created_at: new Date().toISOString(),
      status: "sending",
    };

    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: [...(state.byConversation[conversationId] ?? []), optimistic],
      },
    }));

    try {
      const saved = await api.post<Message>(`/api/conversations/${conversationId}/messages`, {
        body,
        client_id: clientId,
      });
      // Replace the placeholder with the row the server actually stored.
      set((state) => ({
        byConversation: {
          ...state.byConversation,
          [conversationId]: (state.byConversation[conversationId] ?? [])
            .map((m) => (m.local_id === clientId ? { ...saved, local_id: clientId } : m))
            .sort(byId),
        },
      }));
    } catch {
      set((state) => ({
        byConversation: {
          ...state.byConversation,
          [conversationId]: (state.byConversation[conversationId] ?? []).map((m) =>
            m.local_id === clientId ? { ...m, status: "failed" as MessageStatus } : m
          ),
        },
      }));
      useToasts.getState().show("Message not sent", "error");
    }
  },

  applyNew: (message) => {
    const conversationId = message.conversation_id;
    const current = get().byConversation[conversationId];
    // Not loaded yet: the fetch will include this message anyway.
    if (!current) return;

    const alreadyThere = current.some(
      (m) => m.id === message.id || (message.client_id && m.local_id === message.client_id)
    );

    const next = alreadyThere
      ? current.map((m) =>
          m.id === message.id || (message.client_id && m.local_id === message.client_id)
            ? { ...message, local_id: m.local_id, status: message.status ?? m.status }
            : m
        )
      : [...current, message];

    set((state) => ({
      byConversation: { ...state.byConversation, [conversationId]: next.sort(byId) },
    }));
  },

  applyStatus: (conversationId, messageId, status) => {
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: (state.byConversation[conversationId] ?? []).map((m) =>
          m.id === messageId ? { ...m, status } : m
        ),
      },
    }));
  },

  setTyping: (conversationId, userId, isTyping) => {
    set((state) => {
      const current = state.typingBy[conversationId] ?? [];
      const next = isTyping
        ? current.includes(userId)
          ? current
          : [...current, userId]
        : current.filter((id) => id !== userId);
      // Collapse back to the shared empty array so the selector stays stable.
      return {
        typingBy: {
          ...state.typingBy,
          [conversationId]: next.length === 0 ? NO_TYPISTS : next,
        },
      };
    });
  },

  markRead: async (conversationId) => {
    const messages = get().byConversation[conversationId] ?? [];
    const newest = messages.filter((m) => m.id !== Number.MAX_SAFE_INTEGER).at(-1);
    if (!newest) return;
    await api
      .post(`/api/conversations/${conversationId}/read`, { message_id: newest.id })
      .catch(() => undefined);
  },
}));
