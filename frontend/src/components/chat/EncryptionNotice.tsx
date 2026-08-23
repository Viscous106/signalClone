/**
 * The notice Signal shows at the top of every thread.
 *
 * The brief allows encryption to be mocked, so the wording keeps Signal's
 * shape while being explicit that nothing here is actually encrypted —
 * claiming real cryptography would be a false security promise.
 */
export function EncryptionNotice() {
  return (
    <div className="mx-auto mb-3 mt-1 max-w-[320px] rounded-xl bg-surface-2 px-4 py-3 text-center">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="mx-auto mb-1.5 h-4 w-4 text-label-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />
      </svg>
      <p className="text-body2 text-label">Messages and calls are end-to-end encrypted.</p>
      <p className="mt-0.5 text-caption text-label-2">
        Simulated in this demo — no real cryptography is performed.
      </p>
    </div>
  );
}
