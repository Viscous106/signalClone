import { describe, expect, it } from "vitest";

import { COUNTRIES, countryFor, flagFor, searchCountries } from "./countries";

describe("flagFor", () => {
  it("builds the flag from the ISO code, so no emoji are stored", () => {
    expect(flagFor("IN")).toBe("🇮🇳");
    expect(flagFor("US")).toBe("🇺🇸");
    expect(flagFor("de")).toBe("🇩🇪");
  });
});

describe("COUNTRIES", () => {
  it("has no duplicate ISO codes", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("gives every entry a dial code beginning with +", () => {
    expect(COUNTRIES.every((c) => /^\+\d{1,4}$/.test(c.dial))).toBe(true);
  });

  it("covers the countries Signal lists first", () => {
    for (const code of ["US", "DE", "IN", "NL", "UA"]) {
      expect(COUNTRIES.some((c) => c.code === code)).toBe(true);
    }
  });
});

describe("searchCountries", () => {
  it("puts the common ones first when nothing is typed", () => {
    const [first, ...rest] = searchCountries("");
    expect(first.code).toBe("US");
    // The common block is followed by the alphabetical remainder.
    expect(rest.some((c) => c.code === "AF")).toBe(true);
  });

  it("finds by name, case insensitively", () => {
    expect(searchCountries("india").map((c) => c.code)).toContain("IN");
    expect(searchCountries("INDIA").map((c) => c.code)).toContain("IN");
  });

  it("finds by dial code, with or without the plus", () => {
    expect(searchCountries("+91").map((c) => c.code)).toContain("IN");
    expect(searchCountries("91").map((c) => c.code)).toContain("IN");
  });

  it("returns nothing for a term that matches nothing", () => {
    expect(searchCountries("zzzzz")).toEqual([]);
  });

  it("lists the alphabetical remainder in order", () => {
    const names = searchCountries("").slice(5).map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("countryFor", () => {
  it("finds a country from a dial code", () => {
    expect(countryFor("+91")?.code).toBe("IN");
  });

  it("prefers the primary country when several share a code", () => {
    // +1 is the US, Canada and a dozen Caribbean nations.
    expect(countryFor("+1")?.code).toBe("US");
  });

  it("is undefined for an unknown code", () => {
    expect(countryFor("+9999")).toBeUndefined();
  });
});
