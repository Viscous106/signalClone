import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TOAST_MS, useToasts } from "./toasts";

describe("toasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToasts.setState({ items: [] });
  });
  afterEach(() => vi.useRealTimers());

  it("shows a message", () => {
    useToasts.getState().show("Group renamed");
    expect(useToasts.getState().items.map((t) => t.message)).toEqual(["Group renamed"]);
  });

  it("clears itself after a few seconds", () => {
    useToasts.getState().show("Group renamed");
    vi.advanceTimersByTime(TOAST_MS + 10);
    expect(useToasts.getState().items).toEqual([]);
  });

  it("can be dismissed early", () => {
    useToasts.getState().show("Group renamed");
    const { id } = useToasts.getState().items[0];
    useToasts.getState().dismiss(id);
    expect(useToasts.getState().items).toEqual([]);
  });

  it("stacks several without losing any", () => {
    useToasts.getState().show("One");
    useToasts.getState().show("Two");
    expect(useToasts.getState().items).toHaveLength(2);
  });

  it("gives each one a distinct id, even in the same tick", () => {
    useToasts.getState().show("One");
    useToasts.getState().show("Two");
    const [a, b] = useToasts.getState().items;
    expect(a.id).not.toBe(b.id);
  });

  it("keeps only the newest few, so the screen cannot fill up", () => {
    for (let i = 0; i < 8; i += 1) useToasts.getState().show(`Toast ${i}`);
    const items = useToasts.getState().items;
    expect(items.length).toBeLessThanOrEqual(3);
    expect(items.at(-1)?.message).toBe("Toast 7");
  });

  it("marks errors so they can be styled apart", () => {
    useToasts.getState().show("Could not send", "error");
    expect(useToasts.getState().items[0].tone).toBe("error");
  });

  it("defaults to a neutral tone", () => {
    useToasts.getState().show("Saved");
    expect(useToasts.getState().items[0].tone).toBe("info");
  });
})
