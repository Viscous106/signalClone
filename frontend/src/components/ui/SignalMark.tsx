/**
 * Signal's brand mark: a solid speech bubble inside a dashed ring, with the
 * wordmark beside it.
 *
 * Drawn rather than imported so it inherits `currentColor` — brand blue on the
 * login screen, near-white in the empty chat pane, exactly as the real app
 * uses it.
 */

export const SIGNAL_BLUE = "#3B45FD";

export function SignalGlyph({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      fill="none"
    >
      {/* The dashed ring — the most recognisable part of the mark. */}
      <circle
        cx="24"
        cy="24"
        r="21.2"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeDasharray="4.7 3.5"
        strokeLinecap="round"
      />
      {/* Bubble and tail as one filled shape. */}
      <path
        d="M24.8 8.6a14.6 14.6 0 1 1-10.6 24.7l-1.2 1.3-4.3 4.7 1.6-6.2.4-1.4A14.6 14.6 0 0 1 24.8 8.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SignalLockup({
  size = 40,
  wordmark = true,
  className,
  style,
}: {
  size?: number;
  wordmark?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      role="img"
      aria-label="Signal"
      style={style}
      className={`inline-flex items-center gap-2.5 ${className ?? ""}`}
    >
      <SignalGlyph size={size} />
      {wordmark && (
        <span
          aria-hidden="true"
          className="font-semibold leading-none tracking-[-0.02em]"
          style={{ fontSize: Math.round(size * 0.86) }}
        >
          Signal
        </span>
      )}
    </span>
  );
}
