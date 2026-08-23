"use client";

import { useEffect } from "react";

import { firesWhileTyping, isTyping, match } from "@/lib/shortcuts";

/**
 * One document-level listener for the whole app.
 *
 * Handlers are looked up by shortcut id, so a route can supply only the ones it
 * can act on and everything else falls through to the browser untouched.
 */
export function useShortcuts(handlers: Record<string, (() => void) | undefined>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const id = match(event);
      if (!id) return;

      // Escape and the arrows are useful mid-typing; Ctrl+N is not worth
      // stealing from a half-written message.
      if (isTyping(event.target) && !firesWhileTyping(id)) return;

      const handler = handlers[id];
      if (!handler) return;

      event.preventDefault();
      handler();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
