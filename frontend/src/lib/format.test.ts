import { describe, expect, it } from "vitest";

import { dateDivider, initials, listTimestamp, messageTime } from "./format";

// Fixed reference point so these tests never depend on the real clock.
const NOW = new Date("2026-08-22T15:30:00Z");
const at = (iso: string) => new Date(iso).toISOString();

describe("listTimestamp — the right column of the conversation list", () => {
  it("shows a clock time for today", () => {
    expect(listTimestamp(at("2026-08-22T09:04:00Z"), NOW)).toMatch(/^\d{1,2}:\d{2}/);
  });

  it("says Yesterday rather than a time", () => {
    expect(listTimestamp(at("2026-08-21T09:04:00Z"), NOW)).toBe("Yesterday");
  });

  it("shows a weekday name within the last week", () => {
    // 2026-08-18 is a Tuesday.
    expect(listTimestamp(at("2026-08-18T09:04:00Z"), NOW)).toBe("Tue");
  });

  it("falls back to a numeric date once older than a week", () => {
    expect(listTimestamp(at("2026-06-01T09:04:00Z"), NOW)).toMatch(/\d+\/\d+\/\d+/);
  });
});

describe("messageTime — under every bubble", () => {
  it("is always a clock time regardless of age", () => {
    expect(messageTime(at("2020-01-01T23:05:00Z"))).toMatch(/^\d{1,2}:\d{2}/);
  });
});

describe("dateDivider — the separator between days", () => {
  it("labels today and yesterday in words", () => {
    expect(dateDivider(at("2026-08-22T01:00:00Z"), NOW)).toBe("Today");
    expect(dateDivider(at("2026-08-21T01:00:00Z"), NOW)).toBe("Yesterday");
  });

  it("spells out older dates", () => {
    expect(dateDivider(at("2026-08-10T01:00:00Z"), NOW)).toContain("Aug");
  });
});

describe("initials — avatar fallback when there is no photo", () => {
  it("takes first and last initial", () => {
    expect(initials("Alice Chen")).toBe("AC");
  });

  it("uses one letter for a single name", () => {
    expect(initials("Alice")).toBe("A");
  });

  it("caps at two letters for long names", () => {
    expect(initials("Mary Jane Watson Parker")).toBe("MP");
  });

  it("tolerates messy whitespace", () => {
    expect(initials("  bob   martinez  ")).toBe("BM");
  });

  it("degrades gracefully on empty input", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});
