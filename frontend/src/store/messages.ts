import { create } from "zustand";

import { api } from "@/lib/api";
import { type PendingAttachment, toPayload } from "@/lib/attachments";
import { useToasts } from "@/store/toasts";
import type { Message, MessageStatus, Reaction } from "@/lib/types";

export type MessagesState = {
  /** Oldest first, per conversation. */
  byConversation: Record<number, Message[]>;
  /** Who is currently typing, per conversation. */
  typingBy: Record<number, number[]>;
  loaded: Record<number, boolean>;

  load: (conversationId: number) => Promise<void>;
  send: (conversationId: number, draft: Draft, meId: number) => Promise<void>;
  applyNew: (message: Message) => void;
  applyStatus: (conversationId: number, messageId: number, status: MessageStatus) => void;
  applyReactions: (conversationId: number, messageId: number, reactions: Reaction[]) => void;
  react: (conversationId: number, messageId: number, emoji: string) => Promise<void>;
  /** Drop anything whose timer has run out, without waiting for a reload. */
  dropExpired: () => void;
  setTyping: (conversationId: number, userId: number, isTyping: boolean) => void;
  markRead: (conversationId: number) => Promise<void>;
};

/** What the composer hands over: text, files, and what it is replying to. */
export type Draft = {
  body: string;
  attachments?: PendingAttachment[];
  replyToId?: number | null;
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

  send: async (conversationId, draft, meId) => {
    const clientId = crypto.randomUUID();
    const files = draft.attachments ?? [];
    const optimistic: Message = {
      // Sorts last until the server hands back a real id.
      id: Number.MAX_SAFE_INTEGER,
      local_id: clientId,
      conversation_id: conversationId,
      sender_id: meId,
      type: "text",
      body: draft.body,
      created_at: new Date().toISOString(),
      status: "sending",
      reply_to_id: draft.replyToId ?? null,
      // Negative ids: the optimistic thumbnail renders from the data URI we
      // already hold, and cannot collide with a real attachment row.
      attachments: files.map((file, index) => ({
        id: -(index + 1),
        name: file.name,
        mime: file.mime,
        size: file.size,
        data_url: file.data_url,
        width: file.width ?? null,
        height: file.height ?? null,
        is_image: file.is_image,
      })),
    };

    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: [...(state.byConversation[conversationId] ?? []), optimistic],
      },
    }));

    try {
      const saved = await api.post<Message>(`/api/conversations/${conversationId}/messages`, {
        body: draft.body,
        client_id: clientId,
        reply_to_id: draft.replyToId ?? null,
        attachments: toPayload(files),
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

  applyReactions: (conversationId, messageId, reactions) => {
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: (state.byConversation[conversationId] ?? []).map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      },
    }));
  },

  react: async (conversationId, messageId, emoji) => {
    // No optimistic pill: the server decides whether this is an add, a
    // replace, or a removal, and it answers with the grouped result.
    try {
      const updated = await api.post<Message>(
        `/api/conversations/${conversationId}/messages/${messageId}/reactions`,
        { emoji }
      );
      get().applyReactions(conversationId, messageId, updated.reactions ?? []);
    } catch {
      useToasts.getState().show("Could not react", "error");
    }
  },

  dropExpired: () => {
    const now = Date.now();
    const expired = (m: Message) => m.expires_at !== null && m.expires_at !== undefined
      && Date.parse(m.expires_at) <= now;

    const byConversation = get().byConversation;
    // Rebuild only the threads that actually lost something, so an unaffected
    // pane keeps its array identity and does not re-render.
    let touched = false;
    const next: typeof byConversation = {};
    for (const [key, messages] of Object.entries(byConversation)) {
      const kept = messages.filter((m) => !expired(m));
      next[Number(key)] = kept.length === messages.length ? messages : kept;
      if (kept.length !== messages.length) touched = true;
    }
    if (touched) set({ byConversation: next });
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
