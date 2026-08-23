import { create } from "zustand";

/**
 * Per-conversation bubble colour.
 *
 * Local to the device, like [[favorites]]: Signal syncs this, but a column
 * would need a migration the backend has no tooling for, and a wrong colour
 * is a far smaller cost than a wrong message.
 */

const KEY = "signal:chatColors";

/** Signal's own bubble palette. The first is the default outgoing blue. */
export const CHAT_COLORS = [
  { id: "ultramarine", label: "Ultramarine", value: "#2267f5" },
  { id: "crimson", label: "Crimson", value: "#cf163e" },
  { id: "vermilion", label: "Vermilion", value: "#c73f0a" },
  { id: "burlap", label: "Burlap", value: "#6f6a58" },
  { id: "forest", label: "Forest", value: "#3b7845" },
  { id: "wintergreen", label: "Wintergreen", value: "#1d8663" },
  { id: "teal", label: "Teal", value: "#077d92" },
  { id: "blue", label: "Blue", value: "#336ba3" },
  { id: "indigo", label: "Indigo", value: "#6058ca" },
  { id: "violet", label: "Violet", value: "#9932c8" },
  { id: "plum", label: "Plum", value: "#aa377a" },
  { id: "taupe", label: "Taupe", value: "#8f616a" },
] as const;

export const DEFAULT_COLOR = CHAT_COLORS[0].value;

type ChatColorsState = {
  /** conversation id -> hex. Absent means the default. */
  byConversation: Record<number, string>;
  set: (conversationId: number, value: string) => void;
  hydrate: () => void;
};

function persist(map: Record<number, string>) {
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(map));
}

export const useChatColors = create<ChatColorsState>((set, get) => ({
  byConversation: {},

  set: (conversationId, value) => {
    const byConversation = { ...get().byConversation, [conversationId]: value };
    persist(byConversation);
    set({ byConversation });
  },

  /** Called once on mount: the store cannot read storage during SSR. */
  hydrate: () => {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(KEY);
    if (raw === null) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const clean: Record<number, string> = {};
        for (const [key, value] of Object.entries(parsed)) {
          // Only hex we recognise: an arbitrary string here would end up in a
          // style attribute.
          if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
            clean[Number(key)] = value;
          }
        }
        set({ byConversation: clean });
      }
    } catch {
      localStorage.removeItem(KEY);
    }
  },
}));

/** The colour for a conversation, falling back to Signal's default blue. */
export function selectChatColor(conversationId: number) {
  return (state: ChatColorsState): string =>
    state.byConversation[conversationId] ?? DEFAULT_COLOR;
}
