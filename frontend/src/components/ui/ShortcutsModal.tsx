"use client";

import { CloseIcon } from "@/components/ui/icons";
import { SHORTCUTS, displayKeys } from "@/lib/shortcuts";

/**
 * Whether to write ⌘ or Ctrl. Read at render rather than in an effect: this
 * dialog only ever mounts from a key press, so there is no server pass to
 * guard against beyond the typeof check.
 */
function onAMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

/** The help sheet, generated from the same bindings the handler uses. */
export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const isMac = onAMac();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-md overflow-hidden rounded-xl border border-edge bg-surface-2 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-body1 font-semibold text-label">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-label-2 hover:bg-surface hover:text-label"
          >
            <CloseIcon />
          </button>
        </header>

        <dl className="divide-y divide-edge">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="min-w-0 text-body2 text-label">{shortcut.description}</dt>
              <dd className="shrink-0">
                <kbd className="rounded border border-edge bg-surface px-2 py-0.5 font-mono text-caption text-label-2">
                  {displayKeys(shortcut.keys, isMac)}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
