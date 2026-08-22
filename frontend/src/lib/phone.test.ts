import { describe, expect, it } from "vitest";

import {
  displayPhone,
  isValidPhone,
  parseTypedNumber,
  splitInternational,
  toE164,
} from "./phone";

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

describe("splitInternational — reading what the user actually typed", () => {
  const US = { code: "US", name: "United States", dial: "+1" };
  const IN = { code: "IN", name: "India", dial: "+91" };

  it("keeps a plain national number under the selected country", () => {
    expect(splitInternational("5551234567", US)).toEqual({
      country: US,
      national: "5551234567",
    });
  });

  it("re-detects the country when a full number is typed or pasted", () => {
    // The bug this fixes: with the US selected, typing a +91 number produced
    // +1 followed by the Indian digits — a different number entirely, so an
    // existing user was treated as new and asked for a name.
    const result = splitInternational("+919834758028", US);
    expect(result.country.code).toBe("IN");
    expect(result.national).toBe("9834758028");
  });

  it("handles a pasted number with punctuation", () => {
    const result = splitInternational("+1 (555) 123-4567", IN);
    expect(result.country.code).toBe("US");
    expect(result.national).toBe("5551234567");
  });

  it("understands 00 as an international prefix", () => {
    expect(splitInternational("00919834758028", US).country.code).toBe("IN");
  });

  it("prefers the longest matching dial code", () => {
    // +1809 is the Dominican Republic, not the United States.
    expect(splitInternational("+18095551234", US).country.code).toBe("DO");
  });

  it("drops a national trunk zero", () => {
    // 09834758028 dialled inside India is 9834758028 internationally.
    expect(splitInternational("09834758028", IN).national).toBe("9834758028");
  });

  it("keeps the selected country when the dial code is unrecognised", () => {
    const result = splitInternational("+9995551234", US);
    expect(result.country).toEqual(US);
    expect(result.national).toBe("9995551234");
  });

  it("survives just a plus", () => {
    expect(splitInternational("+", US)).toEqual({ country: US, national: "" });
  });

  it("does not mistake a leading 1 in a US number for a country code", () => {
    // No NANP area code starts with 1, so this is a trunk digit.
    expect(splitInternational("15551234567", US).national).toBe("5551234567");
  });
});

describe("parseTypedNumber — only rewrites the field once it is sure", () => {
  const US = { code: "US", name: "United States", dial: "+1" };

  it("returns nothing for a plain national number", () => {
    expect(parseTypedNumber("5551234567", US)).toBeNull();
  });

  it("returns nothing mid-way through typing a dial code", () => {
    // Rewriting here would strip the "+" the user is still typing after.
    expect(parseTypedNumber("+9", US)).toBeNull();
    expect(parseTypedNumber("+", US)).toBeNull();
  });

  it("commits as soon as the dial code is recognisable", () => {
    const result = parseTypedNumber("+91", US);
    expect(result?.country.code).toBe("IN");
    expect(result?.national).toBe("");
  });

  it("commits a fully pasted number", () => {
    const result = parseTypedNumber("+919834758028", US);
    expect(result?.country.code).toBe("IN");
    expect(result?.national).toBe("9834758028");
  });

  it("commits a paste that matches the country already selected", () => {
    const result = parseTypedNumber("+1 555 123 4567", US);
    expect(result?.country.code).toBe("US");
    expect(result?.national).toBe("5551234567");
  });
});
