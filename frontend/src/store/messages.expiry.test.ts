import { beforeEach, describe, expect, it } from "vitest";

import { useMessages } from "./messages";
import type { Message, Reaction } from "@/lib/types";

const message = (over: Partial<Message> & { id: number }): Message => ({
  conversation_id: 1,
  sender_id: 2,
  type: "text",
  body: "hi",
  created_at: "2026-08-23T10:00:00Z",
  ...over,
});

const past = () => new Date(Date.now() - 1000).toISOString();
const future = () => new Date(Date.now() + 60_000).toISOString();

describe("dropExpired", () => {
  beforeEach(() => {
    useMessages.setState({ byConversation: {}, typingBy: {}, loaded: {} });
  });

  it("removes a message whose time is up", () => {
    useMessages.setState({
      byConversation: { 1: [message({ id: 1 }), message({ id: 2, expires_at: past() })] },
    });
    useMessages.getState().dropExpired();
    expect(useMessages.getState().byConversation[1].map((m) => m.id)).toEqual([1]);
  });

  it("keeps one that is still in date", () => {
    useMessages.setState({ byConversation: { 1: [message({ id: 1, expires_at: future() })] } });
    useMessages.getState().dropExpired();
    expect(useMessages.getState().byConversation[1]).toHaveLength(1);
  });

  it("leaves messages with no timer alone", () => {
    useMessages.setState({
      byConversation: { 1: [message({ id: 1 }), message({ id: 2, expires_at: null })] },
    });
    useMessages.getState().dropExpired();
    expect(useMessages.getState().byConversation[1]).toHaveLength(2);
  });

  it("sweeps every thread, not just the open one", () => {
    useMessages.setState({
      byConversation: {
        1: [message({ id: 1, expires_at: past() })],
        2: [message({ id: 2, conversation_id: 2, expires_at: past() })],
      },
    });
    useMessages.getState().dropExpired();
    expect(useMessages.getState().byConversation[1]).toEqual([]);
    expect(useMessages.getState().byConversation[2]).toEqual([]);
  });

  it("keeps the array identity of an untouched thread", () => {
    const untouched = [message({ id: 1 })];
    useMessages.setState({
      byConversation: { 1: untouched, 2: [message({ id: 2, conversation_id: 2, expires_at: past() })] },
    });
    useMessages.getState().dropExpired();
    // Same reference, so that pane does not re-render for nothing.
    expect(useMessages.getState().byConversation[1]).toBe(untouched);
  });

  it("does not write state when nothing expired", () => {
    const before = { 1: [message({ id: 1 })] };
    useMessages.setState({ byConversation: before });
    useMessages.getState().dropExpired();
    expect(useMessages.getState().byConversation).toBe(before);
  });
});

describe("applyStatus arming the clock", () => {
  beforeEach(() => {
    useMessages.setState({
      byConversation: { 1: [message({ id: 5, expire_seconds: 3600 })] },
      typingBy: {},
      loaded: {},
    });
  });

  it("takes the deadline the read handed back", () => {
    const deadline = future();
    useMessages.getState().applyStatus(1, 5, "read", deadline);
    expect(useMessages.getState().byConversation[1][0].expires_at).toBe(deadline);
  });

  it("still records the status when no clock was started", () => {
    useMessages.getState().applyStatus(1, 5, "delivered", null);
    const [held] = useMessages.getState().byConversation[1];
    expect(held.status).toBe("delivered");
    expect(held.expires_at).toBeUndefined();
  });

  it("does not clear a clock that is already running", () => {
    const deadline = future();
    useMessages.getState().applyStatus(1, 5, "read", deadline);
    // A later status event carries no deadline; the countdown must survive it.
    useMessages.getState().applyStatus(1, 5, "read", null);
    expect(useMessages.getState().byConversation[1][0].expires_at).toBe(deadline);
  });
});

describe("applyReactions", () => {
  beforeEach(() => {
    useMessages.setState({ byConversation: { 1: [message({ id: 5 })] }, typingBy: {}, loaded: {} });
  });

  const thumbs: Reaction[] = [{ emoji: "👍", count: 1, names: ["Bob Martinez"], mine: false }];

  it("puts the grouped pills on the right message", () => {
    useMessages.getState().applyReactions(1, 5, thumbs);
    expect(useMessages.getState().byConversation[1][0].reactions).toEqual(thumbs);
  });

  it("ignores a message it does not hold", () => {
    useMessages.getState().applyReactions(1, 999, thumbs);
    expect(useMessages.getState().byConversation[1][0].reactions).toBeUndefined();
  });

  it("replaces rather than appends, so a removal empties the pills", () => {
    useMessages.getState().applyReactions(1, 5, thumbs);
    useMessages.getState().applyReactions(1, 5, []);
    expect(useMessages.getState().byConversation[1][0].reactions).toEqual([]);
  });
});
