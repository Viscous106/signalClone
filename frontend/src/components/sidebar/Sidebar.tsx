"use client";

import { useEffect, useState } from "react";

import { ConversationList } from "@/components/sidebar/ConversationList";
import { ListMenu } from "@/components/sidebar/ListMenu";
import { NewChatPanel } from "@/components/sidebar/NewChatPanel";
import { NewGroupPanel } from "@/components/sidebar/NewGroupPanel";
import { PencilIcon, SearchIcon } from "@/components/ui/icons";
import { useConversations } from "@/store/conversations";

/** The composers replace the list inside this pane rather than floating over
 *  it, which is how Signal does it. */
type View = "chats" | "new-chat" | "new-group";

export function Sidebar({ meId, activeId }: { meId: number; activeId: number | null }) {
  const { items, loading, load } = useConversations();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("chats");
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

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
                unreadOnly={unreadOnly}
                onToggleUnread={() => setUnreadOnly((v) => !v)}
              />
            </div>
          </header>

          {unreadOnly && (
            <div className="px-3 pb-2">
              <button
                onClick={() => setUnreadOnly(false)}
                className="flex w-full items-center justify-between rounded-lg bg-surface px-3 py-1.5 text-body2 text-label"
              >
                Unread only
                <span aria-hidden="true" className="text-label-2">
                  ×
                </span>
              </button>
            </div>
          )}

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

          <div className="min-h-0 flex-1 overflow-y-auto">
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
        </>
      )}
    </aside>
  );
}
