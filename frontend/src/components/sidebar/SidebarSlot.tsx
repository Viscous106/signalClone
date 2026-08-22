"use client";

import { Suspense } from "react";

import { Sidebar } from "@/components/sidebar/Sidebar";
import { useActiveConversationId } from "@/hooks/useActiveConversation";

/**
 * Reads `?c=` and hands it to the sidebar.
 *
 * Split out and suspended because a static export prerenders every route, and
 * search params are unknown at build time.
 */
function SidebarWithActive({ meId }: { meId: number }) {
  return <Sidebar meId={meId} activeId={useActiveConversationId()} />;
}

const placeholder = (
  <aside className="w-[320px] shrink-0 border-r border-edge bg-surface-2" aria-hidden="true" />
);

export function SidebarSlot({ meId }: { meId: number }) {
  return (
    <Suspense fallback={placeholder}>
      <SidebarWithActive meId={meId} />
    </Suspense>
  );
}
