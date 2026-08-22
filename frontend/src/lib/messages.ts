/**
 * Turns a flat message list into the rows the pane renders: date dividers plus
 * messages annotated with their position in a group.
 *
 * Signal collapses consecutive messages from one sender into a run — the
 * shared corner tightens from 18px to 4px and only the last bubble carries a
 * timestamp. Deciding that here keeps the components dumb.
 */

import { dateDivider } from "./format";
import type { Message } from "./types";

/** Same sender within this window keeps the run going. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export type Row =
  | { kind: "divider"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: Message;
      outgoing: boolean;
      groupStart: boolean;
      groupEnd: boolean;
    };

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** System notices stand alone; they belong to no one's run. */
const groupable = (m: Message) => m.type !== "system";

/** Does `current` continue the run that `previous` started? */
function continues(previous?: Message, current?: Message): boolean {
  // Either end may be missing: the first and last message have no neighbour.
  if (!previous || !current) return false;
  if (!groupable(previous) || !groupable(current)) return false;
  if (previous.sender_id !== current.sender_id) return false;

  const before = new Date(previous.created_at);
  const after = new Date(current.created_at);
  if (!sameDay(before, after)) return false;
  return after.getTime() - before.getTime() <= GROUP_WINDOW_MS;
}

/** `messages` must be oldest first. */
export function buildRows(messages: Message[], meId: number, now: Date = new Date()): Row[] {
  const rows: Row[] = [];

  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const when = new Date(message.created_at);

    if (!previous || !sameDay(new Date(previous.created_at), when)) {
      rows.push({
        kind: "divider",
        key: `divider-${message.id}`,
        label: dateDivider(message.created_at, now),
      });
    }

    rows.push({
      kind: "message",
      key: `message-${message.id}`,
      message,
      outgoing: message.sender_id === meId,
      groupStart: !continues(previous, message),
      groupEnd: !continues(message, next),
    });
  });

  return rows;
}
