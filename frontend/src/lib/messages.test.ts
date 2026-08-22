import { describe, expect, it } from "vitest";

import { buildRows } from "./messages";
import type { Message } from "./types";

const ME = 1;
let seq = 0;

const at = (iso: string, senderId: number | null, body = "hi", type: "text" | "system" = "text"): Message => ({
  id: ++seq,
  conversation_id: 1,
  sender_id: senderId,
  type,
  body,
  created_at: new Date(iso).toISOString(),
});

/**
 * Build a message at a local wall-clock time. Date dividers follow the
 * viewer's own day, so tests that straddle midnight must not assume UTC.
 */
const localAt = (
  y: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  senderId: number | null
): Message => ({
  id: ++seq,
  conversation_id: 1,
  sender_id: senderId,
  type: "text",
  body: "hi",
  created_at: new Date(y, month - 1, day, hour, minute).toISOString(),
});

const messageRows = (rows: ReturnType<typeof buildRows>) =>
  rows.filter((r) => r.kind === "message");

describe("buildRows — turning a flat list into what the pane renders", () => {
  it("produces nothing for an empty conversation", () => {
    expect(buildRows([], ME)).toEqual([]);
  });

  it("puts a date divider above the first message", () => {
    const rows = buildRows([at("2026-08-22T10:00:00Z", 2)], ME);
    expect(rows[0].kind).toBe("divider");
  });

  it("adds one divider per day, not per message", () => {
    const rows = buildRows(
      [
        localAt(2026, 8, 21, 10, 0, 2),
        localAt(2026, 8, 21, 11, 0, 2),
        localAt(2026, 8, 22, 9, 0, 2),
      ],
      ME
    );
    expect(rows.filter((r) => r.kind === "divider")).toHaveLength(2);
  });

  it("marks who sent each message relative to me", () => {
    const rows = messageRows(buildRows([at("2026-08-22T10:00:00Z", ME), at("2026-08-22T10:01:00Z", 2)], ME));
    expect(rows.map((r) => r.kind === "message" && r.outgoing)).toEqual([true, false]);
  });
});

describe("grouping consecutive messages", () => {
  it("groups a run from one sender, flagging only the ends", () => {
    const rows = messageRows(
      buildRows(
        [
          at("2026-08-22T10:00:00Z", 2),
          at("2026-08-22T10:01:00Z", 2),
          at("2026-08-22T10:02:00Z", 2),
        ],
        ME
      )
    );
    expect(rows.map((r) => r.kind === "message" && r.groupStart)).toEqual([true, false, false]);
    expect(rows.map((r) => r.kind === "message" && r.groupEnd)).toEqual([false, false, true]);
  });

  it("starts a new group when the sender changes", () => {
    const rows = messageRows(
      buildRows([at("2026-08-22T10:00:00Z", 2), at("2026-08-22T10:01:00Z", ME)], ME)
    );
    expect(rows.every((r) => r.kind === "message" && r.groupStart && r.groupEnd)).toBe(true);
  });

  it("breaks a group after a long silence, even from the same sender", () => {
    const rows = messageRows(
      buildRows([at("2026-08-22T10:00:00Z", 2), at("2026-08-22T11:30:00Z", 2)], ME)
    );
    expect(rows.map((r) => r.kind === "message" && r.groupStart)).toEqual([true, true]);
  });

  it("never groups across a day boundary", () => {
    // One minute apart, but on either side of local midnight.
    const rows = messageRows(
      buildRows([localAt(2026, 8, 21, 23, 59, 2), localAt(2026, 8, 22, 0, 0, 2)], ME)
    );
    expect(rows.map((r) => r.kind === "message" && r.groupStart)).toEqual([true, true]);
  });

  it("keeps system notices out of groups", () => {
    const rows = messageRows(
      buildRows(
        [
          at("2026-08-22T10:00:00Z", 2),
          at("2026-08-22T10:01:00Z", null, "Alice added Bob", "system"),
          at("2026-08-22T10:02:00Z", 2),
        ],
        ME
      )
    );
    // The run is interrupted, so the messages either side stand alone.
    expect(rows.map((r) => r.kind === "message" && r.groupStart)).toEqual([true, true, true]);
  });

  it("gives every row a stable unique key", () => {
    const rows = buildRows(
      [localAt(2026, 8, 21, 10, 0, 2), localAt(2026, 8, 22, 10, 0, 2)],
      ME
    );
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
