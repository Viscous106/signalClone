"use client";

import { useEffect, useState } from "react";

import { ConversationList } from "@/components/sidebar/ConversationList";
import { FilterChips } from "@/components/sidebar/FilterChips";
import { ListMenu } from "@/components/sidebar/ListMenu";
import { NewChatPanel } from "@/components/sidebar/NewChatPanel";
import { NewGroupPanel } from "@/components/sidebar/NewGroupPanel";
import { PencilIcon, SearchIcon } from "@/components/ui/icons";
import { type ChatFilter, filterCounts } from "@/lib/conversation";
import { useConversations } from "@/store/conversations";
import { useFavorites } from "@/store/favorites";

/** The composers replace the list inside this pane rather than floating over
 *  it, which is how Signal does it. */
type View = "chats" | "new-chat" | "new-group";

export function Sidebar({ meId, activeId }: { meId: number; activeId: number | null }) {
  const { items, loading, load } = useConversations();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("chats");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const favoriteIds = useFavorites((s) => s.ids);

  useEffect(() => {
    load();
  }, [load]);

  const counts = filterCounts(items, favoriteIds);

  return (
    <aside className="flex min-w-0 flex-1 flex-col border-r border-edge bg-surface-2 md:w-[320px] md:flex-none">
      {view === "new-chat" && (
        <NewChatPanel onBack={() => setView("chats")} onNewGroup={() => setView("new-group")} />
      )}

      {view === "new-group" && <NewGroupPanel onBack={() => setView("chats")} />}

      {view === "chats" && (
        <>
          <header aria-label="Chats" className="flex h-header shrink-0 items-center justify-between pl-4 pr-2">
            <h1 className="text-title2 font-semibold text-label">Chats</h1>
            <div className="flex items-center">
              <button
                onClick={() => setView("new-chat")}
                aria-label="New chat"
                title="New chat"
                className="rounded-full p-2 text-label-2 hover:bg-surface hover:text-label"
              >
                <PencilIcon />
              </button>
              <ListMenu
                unreadOnly={filter === "unread"}
                onToggleUnread={() =>
                  setFilter((current) => (current === "unread" ? "all" : "unread"))
                }
              />
            </div>
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

          <FilterChips active={filter} counts={counts} onChange={setFilter} />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-6 py-10 text-center text-body2 text-label-2">Loading…</p>
            ) : (
              <ConversationList
                conversations={items}
                meId={meId}
                activeId={activeId}
                query={query}
                filter={filter}
                favoriteIds={favoriteIds}
              />
            )}
          </div>
        </>
      )}
    </aside>
  );
}
