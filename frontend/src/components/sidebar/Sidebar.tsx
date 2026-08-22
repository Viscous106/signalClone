"use client";

import { useEffect, useState } from "react";

import { ConversationList } from "@/components/sidebar/ConversationList";
import { NewChatModal } from "@/components/sidebar/NewChatModal";
import { NewGroupModal } from "@/components/sidebar/NewGroupModal";
import { PencilIcon, SearchIcon } from "@/components/ui/icons";
import { useConversations } from "@/store/conversations";

export function Sidebar({ meId, activeId }: { meId: number; activeId: number | null }) {
  const { items, loading, load } = useConversations();
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState<"none" | "chat" | "group">("none");

  useEffect(() => {
    load();
  }, [load]);

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-r border-edge bg-surface-2">
      <header className="flex h-header shrink-0 items-center justify-between px-4">
        <h1 className="text-title2 font-semibold text-label">Chats</h1>
        <button
          onClick={() => setComposing("chat")}
          aria-label="New chat"
          title="New chat"
          className="rounded-full p-2 text-label-2 hover:bg-surface hover:text-label"
        >
          <PencilIcon />
        </button>
      </header>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5">
          <SearchIcon className="h-4 w-4 shrink-0 text-label-2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search conversations"
            className="w-full bg-transparent py-1 text-body2 text-label outline-none placeholder:text-label-2"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-6 py-10 text-center text-body2 text-label-2">Loading…</p>
        ) : (
          <ConversationList
            conversations={items}
            meId={meId}
            activeId={activeId}
            query={query}
          />
        )}
      </div>

      {composing === "chat" && (
        <NewChatModal
          onClose={() => setComposing("none")}
          onNewGroup={() => setComposing("group")}
        />
      )}
      {composing === "group" && <NewGroupModal onClose={() => setComposing("none")} />}
    </aside>
  );
}
