import { create } from "zustand";

export type Theme = "system" | "light" | "dark";

/** Signal Desktop opens dark; the appearance setting can override it. */
const DEFAULT_THEME: Theme = "dark";

const KEY = {
  theme: "signal:theme",
  readReceipts: "signal:readReceipts",
  typingIndicators: "signal:typingIndicators",
  railExpanded: "signal:railExpanded",
} as const;

function read<T>(key: string, fallback: T, parse: (raw: string) => T): T {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : parse(raw);
}

function write(key: string, value: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
}

/** Toggle the class the design tokens key off. */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", Boolean(dark));
}

type PreferencesState = {
  theme: Theme;
  /** Both default on: receipts and typing are a mutual opt-in in Signal. */
  readReceipts: boolean;
  typingIndicators: boolean;
  /** Nav rail showing labels beside its icons. */
  railExpanded: boolean;
  setTheme: (theme: Theme) => void;
  setReadReceipts: (on: boolean) => void;
  setTypingIndicators: (on: boolean) => void;
  toggleRail: () => void;
  hydrate: () => void;
};

export const usePreferences = create<PreferencesState>((set, get) => ({
  theme: DEFAULT_THEME,
  readReceipts: true,
  typingIndicators: true,
  railExpanded: false,

  setTheme: (theme) => {
    write(KEY.theme, theme);
    applyTheme(theme);
    set({ theme });
  },

  setReadReceipts: (on) => {
    write(KEY.readReceipts, String(on));
    set({ readReceipts: on });
  },

  setTypingIndicators: (on) => {
    write(KEY.typingIndicators, String(on));
    set({ typingIndicators: on });
  },

  toggleRail: () => {
    const next = !get().railExpanded;
    write(KEY.railExpanded, String(next));
    set({ railExpanded: next });
  },

  /** Called once on mount: the store cannot read storage during SSR. */
  hydrate: () => {
    const theme = read<Theme>(KEY.theme, DEFAULT_THEME, (raw) =>
      raw === "light" || raw === "dark" || raw === "system" ? raw : DEFAULT_THEME
    );
    applyTheme(theme);
    set({
      theme,
      readReceipts: read(KEY.readReceipts, true, (raw) => raw !== "false"),
      typingIndicators: read(KEY.typingIndicators, true, (raw) => raw !== "false"),
      railExpanded: read(KEY.railExpanded, false, (raw) => raw === "true"),
    });
  },
}));
