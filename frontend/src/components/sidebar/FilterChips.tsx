"use client";

import type { ChatFilter } from "@/lib/conversation";

/**
 * The chat-list filter row. "All" has no count — it is the resting state, and
 * a number there would just restate the list below it.
 */
const CHIPS: { key: ChatFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "favorites", label: "Favorites" },
  { key: "groups", label: "Groups" },
];

export function FilterChips({
  active,
  counts,
  onChange,
}: {
  active: ChatFilter;
  counts: Record<ChatFilter, number>;
  onChange: (filter: ChatFilter) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter chats"
      className="flex items-center gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CHIPS.map(({ key, label }) => {
        const selected = active === key;
        const count = key === "all" ? 0 : counts[key];
        return (
          <button
            key={key}
            role="tab"
            aria-selected={selected}
            // Without this the name concatenates to "Unread2".
            aria-label={count > 0 ? `${label} ${count}` : label}
            onClick={() => onChange(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-body2 transition-colors ${
              selected
                ? "border-accent bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] text-label"
                : "border-edge text-label-2 hover:bg-surface hover:text-label"
            }`}
          >
            {label}
            {count > 0 && (
              <span className={selected ? "text-label" : "text-label-2"}>{count}</span>
            )}
          </button>
        );
      })}

      {/* Custom folders are the "Add chat folder" item in the list menu, and
          are not built yet. Kept visible for fidelity, like the call buttons. */}
      <button
        disabled
        title="Chat folders — coming soon"
        aria-label="Add chat folder (coming soon)"
        className="shrink-0 cursor-not-allowed rounded-full border border-edge px-3 py-1 text-body2 text-label-2 opacity-50"
      >
        +
      </button>
    </div>
  );
}
