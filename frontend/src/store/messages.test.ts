import { beforeEach, describe, expect, it } from "vitest";

import { selectTyping, useMessages } from "./messages";

describe("selectTyping", () => {
  beforeEach(() => useMessages.setState({ byConversation: {}, typingBy: {}, loaded: {} }));

  it("returns the same reference when nobody is typing", () => {
    // `?? []` inside a selector builds a new array on every call, so React's
    // snapshot comparison never settles: "The result of getSnapshot should be
    // cached to avoid an infinite loop".
    const state = useMessages.getState();
    expect(selectTyping(1)(state)).toBe(selectTyping(1)(state));
  });

  it("is stable across separate reads of the store", () => {
    const first = selectTyping(1)(useMessages.getState());
    const second = selectTyping(1)(useMessages.getState());
    expect(first).toBe(second);
  });

  it("is empty for a conversation with no typists", () => {
    expect(selectTyping(1)(useMessages.getState())).toEqual([]);
  });

  it("returns the actual list when someone is typing", () => {
    useMessages.getState().setTyping(1, 7, true);
    expect(selectTyping(1)(useMessages.getState())).toEqual([7]);
  });

  it("keeps conversations apart", () => {
    useMessages.getState().setTyping(1, 7, true);
    expect(selectTyping(2)(useMessages.getState())).toEqual([]);
  });

  it("goes back to the shared empty array when the last typist stops", () => {
    useMessages.getState().setTyping(1, 7, true);
    useMessages.getState().setTyping(1, 7, false);
    const after = selectTyping(1)(useMessages.getState());
    expect(after).toEqual([]);
    expect(selectTyping(1)(useMessages.getState())).toBe(after);
  });
});
