"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ThemeMenuItem } from "@/components/ui/ThemeToggle";

import { usePreferences } from "@/store/preferences";

/** The chat list's overflow menu, matching the desktop app's items. */
const PLACEHOLDERS = ["View Archive", "Add chat folder", "Notification profile"] as const;

export function ListMenu({
  unreadOnly,
  onToggleUnread,
}: {
  unreadOnly: boolean;
  onToggleUnread: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // The rail carries this on a desktop, but it is hidden on a phone — so the
  // one menu a phone can reach needs it too.
  const theme = usePreferences((s) => s.theme);
  const systemPrefersDark = usePreferences((s) => s.systemPrefersDark);
  const setTheme = usePreferences((s) => s.setTheme);
  const showingDark = theme === "dark" || (theme === "system" && systemPrefersDark);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
        aria-expanded={open}
        title="More options"
        className="rounded-full p-2 text-label-2 hover:bg-surface hover:text-label"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-edge bg-surface-2 py-1 shadow-2xl"
        >
          <button
            role="menuitem"
            onClick={() => {
              onToggleUnread();
              setOpen(false);
            }}
            className="block w-full px-4 py-2 text-left text-body2 text-label hover:bg-surface"
          >
            {unreadOnly ? "Show all chats" : "Filter unread chats"}
          </button>

          <button
            role="menuitem"
            onClick={() => {
              setTheme(showingDark ? "light" : "dark");
              setOpen(false);
            }}
            className="block w-full px-4 py-2 text-left text-body2 text-label hover:bg-surface"
          >
            {showingDark ? "Switch to light mode" : "Switch to dark mode"}
          </button>

          <ThemeMenuItem onDone={() => setOpen(false)} />

          {PLACEHOLDERS.map((label) => (
            <button
              key={label}
              role="menuitem"
              disabled
              title="Coming soon"
              className="block w-full cursor-not-allowed px-4 py-2 text-left text-body2 text-label-2"
            >
              {label}
            </button>
          ))}

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-body2 text-label hover:bg-surface"
          >
            Settings
          </Link>
        </div>
      )}
    </div>
  );
}
