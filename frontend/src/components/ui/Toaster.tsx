"use client";

import { useToasts } from "@/store/toasts";

/**
 * Signal shows toasts as a dark pill near the bottom of the chat pane. Kept
 * out of the flow so it never shifts the layout.
 */
export function Toaster() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {items.map((toast) => (
        <div
          key={toast.id}
          data-testid="toast"
          data-tone={toast.tone}
          className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg px-4 py-2.5 shadow-2xl ${
            toast.tone === "error"
              ? "bg-[#CF163E] text-white"
              : "bg-surface-2 text-label ring-1 ring-[color:var(--border-primary)]"
          }`}
        >
          <span className="text-body2">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
            className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
