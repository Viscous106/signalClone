"use client";

import { useSearchParams } from "next/navigation";

/**
 * Which conversation is open, from `?c=`.
 *
 * A search param rather than a path segment so the whole frontend can be a
 * static export — a dynamic `[id]` route would need its ids known at build
 * time. Signal Desktop has no URLs at all, so nothing is lost.
 */
export function useActiveConversationId(): number | null {
  const params = useSearchParams();
  const raw = params.get("c");
  const id = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(id) ? id : null;
}

export function chatHref(conversationId: number): string {
  return `/chat?c=${conversationId}`;
}
