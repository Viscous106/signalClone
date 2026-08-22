import { create } from "zustand";

/** How long a toast stays before it clears itself. */
export const TOAST_MS = 4000;

/** More than this on screen at once is noise. */
const MAX_VISIBLE = 3;

export type Toast = {
  id: number;
  message: string;
  tone: "info" | "error";
};

type ToastState = {
  items: Toast[];
  show: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
};

let nextId = 0;

export const useToasts = create<ToastState>((set, get) => ({
  items: [],

  show: (message, tone = "info") => {
    // A counter, not a timestamp: two toasts in the same millisecond would
    // otherwise collide and React would reuse one key for both.
    const id = (nextId += 1);
    set({ items: [...get().items, { id, message, tone }].slice(-MAX_VISIBLE) });
    setTimeout(() => get().dismiss(id), TOAST_MS);
  },

  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));
