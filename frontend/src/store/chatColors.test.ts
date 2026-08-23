import { beforeEach, describe, expect, it } from "vitest";

import { CHAT_COLORS, DEFAULT_COLOR, selectChatColor, useChatColors } from "./chatColors";

const KEY = "signal:chatColors";

describe("chat colors", () => {
  beforeEach(() => {
    localStorage.clear();
    useChatColors.setState({ byConversation: {} });
  });

  it("falls back to Signal's blue for a conversation with no choice", () => {
    expect(selectChatColor(1)(useChatColors.getState())).toBe(DEFAULT_COLOR);
  });

  it("keeps a choice per conversation", () => {
    useChatColors.getState().set(1, CHAT_COLORS[1].value);
    const state = useChatColors.getState();
    expect(selectChatColor(1)(state)).toBe(CHAT_COLORS[1].value);
    expect(selectChatColor(2)(state)).toBe(DEFAULT_COLOR);
  });

  it("survives a reload", () => {
    useChatColors.getState().set(3, CHAT_COLORS[4].value);
    useChatColors.setState({ byConversation: {} });

    useChatColors.getState().hydrate();
    expect(selectChatColor(3)(useChatColors.getState())).toBe(CHAT_COLORS[4].value);
  });

  it("refuses anything that is not a hex colour", () => {
    // The value lands in a style attribute, so it is never trusted verbatim.
    localStorage.setItem(KEY, JSON.stringify({ 1: "javascript:alert(1)", 2: "#ff0000" }));
    useChatColors.getState().hydrate();

    expect(selectChatColor(1)(useChatColors.getState())).toBe(DEFAULT_COLOR);
    expect(selectChatColor(2)(useChatColors.getState())).toBe("#ff0000");
  });

  it("starts clean on a corrupt entry rather than crashing the shell", () => {
    localStorage.setItem(KEY, "{not json");
    useChatColors.getState().hydrate();

    expect(useChatColors.getState().byConversation).toEqual({});
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
