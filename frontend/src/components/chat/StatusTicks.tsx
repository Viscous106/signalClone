/**
 * Signal's delivery indicator. The distinction that matters is fill, not
 * colour: read shows *filled* checks, delivered shows outlined ones.
 */

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed" | null;

const LABELS: Record<Exclude<MessageStatus, null>, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Not sent",
};

export function StatusTicks({ status }: { status: MessageStatus }) {
  if (!status) return null;

  const label = LABELS[status];

  if (status === "sending") {
    return (
      <span aria-label={label} title={label} className="inline-block">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 animate-spin opacity-70">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeDasharray="28" strokeDashoffset="20" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span aria-label={label} title={label} className="inline-block text-[#CF163E]">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 4.5v5M8 11.2v.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  const double = status !== "sent";
  const filled = status === "read";

  return (
    <span aria-label={label} title={label} data-filled={filled} className="inline-block">
      <svg viewBox="0 0 20 16" className="h-3.5 w-4">
        <path
          d="M2 9.2 5.1 12.3 11 5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={filled ? 2.4 : 1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {double && (
          <path
            d="M8.4 9.2 11.5 12.3 17.4 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={filled ? 2.4 : 1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  );
}
