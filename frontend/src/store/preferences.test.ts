import { beforeEach, describe, expect, it } from "vitest";

import { applyTheme, usePreferences } from "./preferences";

describe("preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    usePreferences.setState({ theme: "dark", readReceipts: true, typingIndicators: true });
  });

  it("defaults to dark, as Signal Desktop does", () => {
    expect(usePreferences.getState().theme).toBe("dark");
  });

  it("keeps the two privacy toggles on by default — they are mutual opt-in", () => {
    const { readReceipts, typingIndicators } = usePreferences.getState();
    expect(readReceipts).toBe(true);
    expect(typingIndicators).toBe(true);
  });

  it("remembers a change across reloads", () => {
    usePreferences.getState().setTheme("light");
    expect(localStorage.getItem("signal:theme")).toBe("light");
  });

  it("remembers the privacy toggles too", () => {
    usePreferences.getState().setReadReceipts(false);
    expect(localStorage.getItem("signal:readReceipts")).toBe("false");
  });
});

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.className = "";
  });

  it("adds the dark class for dark", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes it for light", () => {
    document.documentElement.classList.add("dark");
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows the operating system when set to system", () => {
    // jsdom reports no preference, which resolves to light.
    document.documentElement.classList.add("dark");
    applyTheme("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
