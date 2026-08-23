"use client";

import type { Reaction } from "@/lib/types";

/** The tray. Must match ALLOWED in the backend's reactions service. */
export const TRAY = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

/**
 * Pills under a bubble. A pill you are in is outlined, so you can tell your own
 * reaction from everyone else's without reading the tooltip.
 */
export function ReactionPills({
  reactions,
  onToggle,
}: {
  reactions: Reaction[];
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;

  return (
    <div
      data-testid="reaction-pills"
      className="-mt-1 flex flex-wrap gap-1 px-1"
    >
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => onToggle(reaction.emoji)}
          title={`${reaction.names.join(", ")} reacted ${reaction.emoji}`}
          aria-label={`${reaction.emoji} ${reaction.count}${reaction.mine ? ", including you" : ""}`}
          aria-pressed={reaction.mine}
          className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-caption transition-colors ${
            reaction.mine
              ? "border-accent bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] text-label"
              : "border-edge bg-surface-2 text-label-2 hover:text-label"
          }`}
        >
          <span aria-hidden="true">{reaction.emoji}</span>
          {/* A lone reaction needs no "1" beside it. */}
          {reaction.count > 1 && <span>{reaction.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** The picker that opens from the bubble's react button. */
export function ReactionTray({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div
      role="menu"
      aria-label="React"
      className="absolute bottom-full z-20 mb-1 flex gap-0.5 rounded-full border border-edge bg-surface-2 px-1.5 py-1 shadow-2xl"
    >
      {TRAY.map((emoji) => (
        <button
          key={emoji}
          role="menuitem"
          onClick={() => onPick(emoji)}
          aria-label={`React ${emoji}`}
          className="rounded-full px-1 text-body1 transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
