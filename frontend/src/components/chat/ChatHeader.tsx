"use client";

import { Avatar } from "@/components/ui/Avatar";
import { CallIcon, SearchIcon } from "@/components/ui/icons";
import { listTimestamp } from "@/lib/format";
import { conversationTitle, otherMember } from "@/lib/conversation";
import type { Conversation } from "@/lib/types";

export function ChatHeader({
  conversation,
  meId,
  typingLabel,
}: {
  conversation: Conversation;
  meId: number;
  typingLabel: string | null;
}) {
  const title = conversationTitle(conversation, meId);
  const counterpart = otherMember(conversation, meId);

  const subtitle = typingLabel
    ? `${typingLabel} is typing…`
    : conversation.type === "group"
      ? `${conversation.members.length} members`
      : counterpart?.online
        ? "Online"
        : counterpart?.last_seen_at
          ? `Last seen ${listTimestamp(counterpart.last_seen_at)}`
          : counterpart?.phone ?? "";

  return (
    <header className="flex h-header shrink-0 items-center gap-3 border-b border-edge px-4">
      <Avatar
        name={title}
        size={32}
        color={conversation.type === "group" ? conversation.avatar_color : counterpart?.avatar_color}
        url={conversation.avatar_url ?? counterpart?.avatar_url}
        online={counterpart?.online ?? false}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body1 font-semibold text-label">{title}</p>
        <p className="truncate text-body2 text-label-2">{subtitle}</p>
      </div>

      {/* Calling and in-chat search are out of scope; kept visible for fidelity. */}
      <div className="flex items-center gap-1 text-label-2">
        {[
          { key: "video", label: "Video call", node: <CallIcon className="h-5 w-5" /> },
          { key: "search", label: "Search in chat", node: <SearchIcon className="h-5 w-5" /> },
        ].map(({ key, label, node }) => (
          <button
            key={key}
            title={`${label} — coming soon`}
            aria-label={`${label} (coming soon)`}
            className="cursor-not-allowed rounded-md p-2 opacity-50"
          >
            {node}
          </button>
        ))}
      </div>
    </header>
  );
}
