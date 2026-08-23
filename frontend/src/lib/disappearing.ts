/**
 * Disappearing-message durations.
 *
 * Must match CHOICES in the backend's disappearing service — the API refuses
 * anything else, so an option here that is not there would only ever 400.
 */

export const DISAPPEAR_CHOICES = [
  { seconds: 0, label: "Off" },
  { seconds: 30, label: "30 seconds" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 3600, label: "1 hour" },
  { seconds: 28800, label: "8 hours" },
  { seconds: 86400, label: "1 day" },
  { seconds: 604800, label: "1 week" },
  { seconds: 2419200, label: "4 weeks" },
] as const;

export function disappearLabel(seconds: number): string {
  return DISAPPEAR_CHOICES.find((c) => c.seconds === seconds)?.label ?? `${seconds} seconds`;
}
