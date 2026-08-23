import { create } from "zustand";

/**
 * Favourited conversations.
 *
 * Kept in localStorage rather than on the server: the backend has no migration
 * tooling, so a new column could not reach an existing database. That makes
 * favourites per-device, which is the one way this differs from Signal.
 */

const KEY = "signal:favorites";

type FavoritesState = {
  ids: number[];
  toggle: (conversationId: number) => void;
  hydrate: () => void;
};

function persist(ids: number[]) {
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(ids));
}

export const useFavorites = create<FavoritesState>((set, get) => ({
  ids: [],

  toggle: (conversationId) => {
    const current = get().ids;
    const ids = current.includes(conversationId)
      ? current.filter((id) => id !== conversationId)
      : [...current, conversationId];
    persist(ids);
    set({ ids });
  },

  /** Called once on mount: the store cannot read storage during SSR. */
  hydrate: () => {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(KEY);
    if (raw === null) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        set({ ids: parsed.filter((id): id is number => typeof id === "number") });
      }
    } catch {
      // Corrupt entry: start clean rather than crashing the whole app shell.
      localStorage.removeItem(KEY);
    }
  },
}));
