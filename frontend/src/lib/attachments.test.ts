import { beforeAll, describe, expect, it, vi } from "vitest";

import { ACCEPT, MAX_BYTES, attachmentSummary, formatSize, prepare, toPayload } from "./attachments";
import type { Attachment } from "./types";

const file = (name: string, type: string, size: number) => {
  const f = new File(["x"], name, { type });
  // File size is derived from content; override it to test the cap cheaply.
  Object.defineProperty(f, "size", { value: size });
  return f;
};

// jsdom fires neither load nor error for a data URI, so the real Image would
// only ever hit prepare's decode timeout. Resolve it immediately instead.
beforeAll(() => {
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      naturalWidth = 800;
      naturalHeight = 600;
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
  );
});

const image = (over: Partial<Attachment> = {}): Attachment => ({
  id: 1,
  name: "beach.png",
  mime: "image/png",
  size: 2048,
  data_url: "data:image/png;base64,AAA",
  is_image: true,
  ...over,
});

describe("formatSize", () => {
  it("uses the unit that keeps the number short", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2 KB");
    expect(formatSize(1024 * 1024 * 1.5)).toBe("1.5 MB");
  });
});

describe("prepare", () => {
  it("refuses a type the server would reject anyway", async () => {
    const { ready, errors } = await prepare([file("app.exe", "application/x-msdownload", 10)]);
    expect(ready).toEqual([]);
    expect(errors[0]).toMatch(/not a supported type/);
  });

  it("refuses SVG, which runs script when opened", async () => {
    expect(ACCEPT).not.toContain("svg");
    const { ready } = await prepare([file("x.svg", "image/svg+xml", 10)]);
    expect(ready).toEqual([]);
  });

  it("refuses a file over the cap before building a request body", async () => {
    const { ready, errors } = await prepare([file("big.png", "image/png", MAX_BYTES + 1)]);
    expect(ready).toEqual([]);
    expect(errors[0]).toMatch(/over/);
  });

  it("reports one rejection without losing the rest", async () => {
    const { ready, errors } = await prepare([
      file("ok.png", "image/png", 100),
      file("big.png", "image/png", MAX_BYTES + 1),
    ]);
    expect(ready).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });

  it("marks images as such and everything else not", async () => {
    const { ready } = await prepare([
      file("a.png", "image/png", 100),
      file("b.pdf", "application/pdf", 100),
    ]);
    expect(ready.map((f) => f.is_image)).toEqual([true, false]);
  });
});

describe("toPayload", () => {
  it("drops the local key the server has no use for", async () => {
    const { ready } = await prepare([file("a.png", "image/png", 100)]);
    expect(Object.keys(toPayload(ready)[0]).sort()).toEqual([
      "data_url",
      "height",
      "mime",
      "name",
      "width",
    ]);
  });
});

describe("attachmentSummary", () => {
  it("says Photo for a single image, since its filename is noise", () => {
    expect(attachmentSummary([image()])).toBe("Photo");
  });

  it("names a single file, since its filename is the point", () => {
    expect(attachmentSummary([image({ name: "notes.pdf", is_image: false })])).toBe("notes.pdf");
  });

  it("counts several rather than listing them", () => {
    expect(attachmentSummary([image(), image({ id: 2 })])).toBe("2 attachments");
  });

  it("is empty when there are none", () => {
    expect(attachmentSummary([])).toBe("");
  });
});
