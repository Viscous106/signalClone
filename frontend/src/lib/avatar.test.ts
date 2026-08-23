import { describe, expect, it } from "vitest";

import { AVATAR_PX, MAX_AVATAR_BYTES, centreSquare, isAcceptableImage } from "./avatar";

describe("centreSquare — crop to a square without stretching", () => {
  it("takes the middle of a landscape photo", () => {
    expect(centreSquare(1000, 600)).toEqual({ sx: 200, sy: 0, size: 600 });
  });

  it("takes the middle of a portrait photo", () => {
    expect(centreSquare(600, 1000)).toEqual({ sx: 0, sy: 200, size: 600 });
  });

  it("leaves a square alone", () => {
    expect(centreSquare(800, 800)).toEqual({ sx: 0, sy: 0, size: 800 });
  });

  it("handles a one-pixel image without going negative", () => {
    expect(centreSquare(1, 1)).toEqual({ sx: 0, sy: 0, size: 1 });
  });
});

describe("isAcceptableImage", () => {
  const file = (type: string, size: number) => ({ type, size }) as File;

  it("accepts ordinary photo formats", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(isAcceptableImage(file(type, 1000))).toBe(true);
    }
  });

  it("refuses anything that is not an image", () => {
    expect(isAcceptableImage(file("application/pdf", 1000))).toBe(false);
    expect(isAcceptableImage(file("text/html", 10))).toBe(false);
  });

  it("refuses a file too large to be worth resizing", () => {
    expect(isAcceptableImage(file("image/jpeg", MAX_AVATAR_BYTES + 1))).toBe(false);
  });

  it("targets a sensible square", () => {
    expect(AVATAR_PX).toBeGreaterThanOrEqual(128);
    expect(AVATAR_PX).toBeLessThanOrEqual(512);
  });
});
