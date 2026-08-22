"use client";

import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { BackIcon, CallIcon, SearchIcon } from "@/components/ui/icons";
import { listTimestamp } from "@/lib/format";
import { conversationTitle, otherMember } from "@/lib/conversation";
import type { Conversation } from "@/lib/types";

export function ChatHeader({
  conversation,
  meId,
  typingLabel,
  onOpenInfo,
}: {
  conversation: Conversation;
  meId: number;
  typingLabel: string | null;
  onOpenInfo?: () => void;
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
    <header className="flex h-header shrink-0 items-center gap-2 border-b border-edge px-2 md:gap-3 md:px-4">
      {/* On a phone the thread replaces the list, so it needs a way back. */}
      <Link
        href="/"
        aria-label="Back to chats"
        className="rounded-full p-2 text-label hover:bg-surface-2 md:hidden"
      >
        <BackIcon />
      </Link>
      <Avatar
        name={title}
        size={32}
        color={conversation.type === "group" ? conversation.avatar_color : counterpart?.avatar_color}
        fg={conversation.type === "group" ? conversation.avatar_fg : counterpart?.avatar_fg}
        url={conversation.avatar_url ?? counterpart?.avatar_url}
        online={counterpart?.online ?? false}
      />
      {conversation.type === "group" && onOpenInfo ? (
        <button
          onClick={onOpenInfo}
          className="min-w-0 flex-1 text-left"
          aria-label="Group info"
        >
          <p className="truncate text-body1 font-semibold text-label">{title}</p>
          <p className="truncate text-body2 text-label-2">{subtitle}</p>
        </button>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-body1 font-semibold text-label">{title}</p>
          <p className="truncate text-body2 text-label-2">{subtitle}</p>
        </div>
      )}

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
