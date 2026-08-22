/**
 * Timestamp and label formatting, matching Signal's conventions.
 * Rules verified against the app; see docs/SIGNAL-UI-REFERENCE.md.
 */

const MS_PER_DAY = 86_400_000;

/** Midnight-to-midnight difference in the viewer's own timezone. */
function calendarDaysApart(a: Date, b: Date): number {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(b) - startOf(a)) / MS_PER_DAY);
}

function clockTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Right-hand column of the conversation list. Signal degrades the precision as
 * the message ages: time → "Yesterday" → weekday → date.
 */
export function listTimestamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const days = calendarDaysApart(d, now);

  if (days <= 0) return clockTime(d);
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" });
}

/** Under a bubble Signal always shows a clock time, however old the message. */
export function messageTime(iso: string): string {
  return clockTime(new Date(iso));
}

/** The centred separator between days in the message list. */
export function dateDivider(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const days = calendarDaysApart(d, now);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";

  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Avatar fallback letters. First and last initial, so "Mary Jane Watson Parker"
 * reads as MP the way Signal renders it.
 */
export function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";

  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
