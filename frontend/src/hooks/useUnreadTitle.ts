"use client";

import { useEffect } from "react";

import { useConversations } from "@/store/conversations";

/** Unread count in the tab title, the way a messaging app should. */
export function useUnreadTitle() {
  const items = useConversations((s) => s.items);

  useEffect(() => {
    const total = items.reduce((sum, c) => sum + c.unread_count, 0);
    document.title = total > 0 ? `(${total}) Signal` : "Signal";
  }, [items]);
}
