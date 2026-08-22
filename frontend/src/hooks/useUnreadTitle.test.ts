import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useUnreadTitle } from "./useUnreadTitle";
import type { Conversation } from "@/lib/types";
import { useConversations } from "@/store/conversations";

const conv = (id: number, unread: number): Conversation => ({
  id,
  type: "direct",
  name: null,
  avatar_url: null,
  avatar_color: "#D8E8F0",
  avatar_fg: "#086DA0",
  created_by: 1,
  created_at: "2026-08-22T09:00:00Z",
  last_message_at: "2026-08-22T10:00:00Z",
  members: [],
  last_message: null,
  unread_count: unread,
});

describe("useUnreadTitle", () => {
  beforeEach(() => {
    document.title = "";
    useConversations.setState({ items: [], loading: false });
  });

  it("is just the app name when nothing is unread", () => {
    renderHook(() => useUnreadTitle());
    expect(document.title).toBe("Signal");
  });

  it("counts every unread message, not every unread chat", () => {
    useConversations.setState({ items: [conv(1, 2), conv(2, 3)], loading: false });
    renderHook(() => useUnreadTitle());
    expect(document.title).toBe("(5) Signal");
  });

  it("drops the badge once everything is read", () => {
    useConversations.setState({ items: [conv(1, 2)], loading: false });
    const { rerender } = renderHook(() => useUnreadTitle());
    expect(document.title).toBe("(2) Signal");

    useConversations.setState({ items: [conv(1, 0)], loading: false });
    rerender();
    expect(document.title).toBe("Signal");
  });
})
