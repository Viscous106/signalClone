/**
 * The keyboard map, and the rule for when a key press is ours to take.
 *
 * Kept as data so the help modal and the handler cannot drift apart: the sheet
 * you read is generated from the bindings that actually fire.
 */

export type Shortcut = {
  id: string;
  /** As typed, for the help sheet. */
  keys: string;
  description: string;
  /** Whether it fires while the caret is in a text box. */
  whileTyping?: boolean;
};

export const SHORTCUTS: Shortcut[] = [
  { id: "search", keys: "Ctrl+K", description: "Search conversations" },
  { id: "new-chat", keys: "Ctrl+N", description: "New chat" },
  { id: "next-chat", keys: "Alt+↓", description: "Next conversation", whileTyping: true },
  { id: "previous-chat", keys: "Alt+↑", description: "Previous conversation", whileTyping: true },
  { id: "settings", keys: "Ctrl+,", description: "Open settings" },
  { id: "theme", keys: "Ctrl+Shift+D", description: "Switch light / dark mode" },
  { id: "close", keys: "Escape", description: "Close panel or clear search", whileTyping: true },
  { id: "help", keys: "Ctrl+/", description: "Show this list", whileTyping: true },
];

/**
 * Is the caret somewhere that owns its own keys?
 *
 * A shortcut that steals a keystroke mid-sentence is worse than no shortcut,
 * so anything unmodified is left alone while typing.
 */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  // Coerced: isContentEditable is undefined on elements that never set it,
  // and this function promises a boolean.
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable === true
  );
}

/** The shortcut this event maps to, or null. */
export function match(event: KeyboardEvent): string | null {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key;

  if (key === "Escape") return "close";
  if (mod && (key === "/" || key === "?")) return "help";
  // Shift-qualified so it cannot be confused with anything else on Ctrl+D.
  if (mod && event.shiftKey && key.toLowerCase() === "d") return "theme";
  if (mod && key.toLowerCase() === "k") return "search";
  if (mod && key.toLowerCase() === "n") return "new-chat";
  if (mod && key === ",") return "settings";
  // Shift-qualified: plain Ctrl+L is the browser's address bar.
  if (mod && event.shiftKey && key.toLowerCase() === "l") return "theme";
  // Alt rather than plain arrows: the arrows belong to the message box and to
  // scrolling the thread.
  if (event.altKey && key === "ArrowDown") return "next-chat";
  if (event.altKey && key === "ArrowUp") return "previous-chat";
  return null;
}

/** Whether this shortcut is allowed to fire from inside a text box. */
export function firesWhileTyping(id: string): boolean {
  return SHORTCUTS.find((s) => s.id === id)?.whileTyping === true;
}

/** Ctrl on Linux and Windows, ⌘ on a Mac — the sheet should say what you press. */
export function displayKeys(keys: string, isMac: boolean): string {
  return isMac ? keys.replace("Ctrl", "⌘").replace("Alt", "⌥") : keys;
}
