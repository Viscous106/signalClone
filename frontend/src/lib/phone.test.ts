import { describe, expect, it } from "vitest";

import { displayPhone, isValidPhone, toE164 } from "./phone";

describe("toE164 — what we send to the API", () => {
  it("keeps only digits behind a single plus", () => {
    expect(toE164("+1 (555) 123-4567")).toBe("+15551234567");
    expect(toE164("+1-555-123-4567")).toBe("+15551234567");
    expect(toE164("  +15551234567  ")).toBe("+15551234567");
  });

  it("matches the server's normalisation so one person is one account", () => {
    const written = ["+1 555 123 4567", "+1(555)1234567", "+1 555-123-4567"];
    expect(new Set(written.map(toE164)).size).toBe(1);
  });
});

describe("isValidPhone — gates the Continue button", () => {
  it("accepts a plausible international number", () => {
    expect(isValidPhone("+15551234567")).toBe(true);
    expect(isValidPhone("+91 98765 43210")).toBe(true);
  });

  it("rejects too short, too long, and non-numeric", () => {
    expect(isValidPhone("555")).toBe(false);
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("hello")).toBe(false);
    expect(isValidPhone("+1234567890123456789")).toBe(false);
  });
});

describe("displayPhone — echoed back on the verification screen", () => {
  it("groups digits for readability", () => {
    expect(displayPhone("+15551234567")).toBe("+1 555 123 4567");
  });

  it("passes through anything it cannot group", () => {
    expect(displayPhone("+4471234")).toContain("+44");
  });
});
