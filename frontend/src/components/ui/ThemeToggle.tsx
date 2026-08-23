"use client";

import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { usePreferences } from "@/store/preferences";

/**
 * The state a one-click theme switch needs.
 *
 * Shared by every surface that offers the switch — the rail, the chat-list
 * menu, the keyboard shortcut — so they cannot disagree about which way it
 * goes or what to call it.
 *
 * Settings → Appearance keeps the three-way choice including "System"; a
 * toggle only ever moves between the two explicit modes. Starting from
 * "System" it commits to the opposite of what you are currently looking at,
 * which is what someone reaching for a toggle is asking for.
 */
export function useThemeSwitch() {
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const systemPrefersDark = usePreferences((s) => s.systemPrefersDark);

  const showingDark = theme === "dark" || (theme === "system" && systemPrefersDark);

  return {
    showingDark,
    /** What the mode is called after the switch. */
    nextLabel: showingDark ? "Light mode" : "Dark mode",
    actionLabel: showingDark ? "Switch to light mode" : "Switch to dark mode",
    toggle: () => setTheme(showingDark ? "light" : "dark"),
  };
}

/** One-click light/dark, as an icon button for the nav rail. */
export function ThemeToggle({ expanded = false }: { expanded?: boolean }) {
  const { showingDark, nextLabel, actionLabel: label, toggle } = useThemeSwitch();

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex h-12 items-center rounded-lg text-label-2 transition-colors hover:bg-surface hover:text-label ${
        expanded ? "w-full gap-3 px-3" : "w-12 justify-center"
      }`}
    >
      <span className="shrink-0">{showingDark ? <SunIcon /> : <MoonIcon />}</span>
      {expanded && (
        <span data-testid="theme-label" className="truncate text-body2">
          {nextLabel}
        </span>
      )}
    </button>
  );
}

/**
 * The same switch as a menu row.
 *
 * The rail is `hidden md:flex`, so on a phone it is the only one-click way to
 * change theme — the chat-list menu is reachable at every breakpoint.
 */
export function ThemeMenuItem({ onDone }: { onDone?: () => void }) {
  const { showingDark, nextLabel, toggle } = useThemeSwitch();

  return (
    <button
      role="menuitem"
      onClick={() => {
        toggle();
        onDone?.();
      }}
      className="flex w-full items-center gap-2 px-4 py-2 text-left text-body2 text-label hover:bg-surface"
    >
      <span className="shrink-0 text-label-2">
        {showingDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
      </span>
      {nextLabel}
    </button>
  );
}
