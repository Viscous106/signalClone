"use client";

import Link from "next/link";

import { chatHref } from "@/hooks/useActiveConversation";

import { listTimestamp } from "@/lib/format";
import { conversationTitle, matchesSearch, otherMember, previewText } from "@/lib/conversation";
import type { Conversation } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

type Props = {
  conversations: Conversation[];
  meId: number;
  activeId: number | null;
  query: string;
  /** Show only conversations with something unread. */
  unreadOnly?: boolean;
};

export function ConversationList({
  conversations,
  meId,
  activeId,
  query,
  unreadOnly = false,
}: Props) {
  const visible = conversations
    .filter((c) => matchesSearch(c, meId, query))
    .filter((c) => !unreadOnly || c.unread_count > 0);

  if (visible.length === 0) {
    const empty = unreadOnly
      ? { title: "No unread chats", body: "You are all caught up." }
      : query.trim()
        ? { title: "No results", body: `Nothing matched "${query.trim()}"` }
        : { title: "No chats", body: "Recent chats will appear here." };

    return (
      <div className="px-6 py-16 text-center">
        <p className="text-body1 font-semibold text-label">{empty.title}</p>
        <p className="mt-1 text-body2 text-label-2">{empty.body}</p>
      </div>
    );
  }

  return (
    <ul>
      {visible.map((conversation) => (
        <Row
          key={conversation.id}
          conversation={conversation}
          meId={meId}
          active={conversation.id === activeId}
        />
      ))}
    </ul>
  );
}

function Row({
  conversation,
  meId,
  active,
}: {
  conversation: Conversation;
  meId: number;
  active: boolean;
}) {
  const title = conversationTitle(conversation, meId);
  const preview = previewText(conversation, meId);
  const counterpart = otherMember(conversation, meId);
  const unread = conversation.unread_count;

  return (
    <li>
      <Link
        href={chatHref(conversation.id)}
        aria-current={active ? "page" : undefined}
        // 72px row, 11px inline padding — Signal's own metrics.
        className={`flex h-row items-center gap-3 px-[11px] transition-colors ${
          active ? "bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)]" : "hover:bg-surface-2"
        }`}
      >
        <Avatar
          name={title}
          color={conversation.type === "group" ? conversation.avatar_color : counterpart?.avatar_color}
          fg={conversation.type === "group" ? conversation.avatar_fg : counterpart?.avatar_fg}
          url={conversation.avatar_url ?? counterpart?.avatar_url}
          online={counterpart?.online ?? false}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              data-testid="conversation-title"
              className={`truncate text-body1 ${unread > 0 ? "font-semibold text-label" : "text-label"}`}
            >
              {title}
            </span>
            <span
              className={`shrink-0 text-caption ${unread > 0 ? "text-accent" : "text-label-2"}`}
            >
              {listTimestamp(conversation.last_message_at)}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span
              className={`truncate text-body2 ${
                unread > 0 ? "text-label" : "text-label-2"
              }`}
            >
              {preview}
            </span>
            {unread > 0 && (
              <span
                data-testid="unread-badge"
                className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-caption font-semibold text-white"
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
