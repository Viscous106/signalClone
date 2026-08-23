/**
 * Display rules for a conversation. Signal's conventions live here rather than
 * in the API, so the server stays structural and these stay testable.
 */

import { attachmentSummary } from "./attachments";
import type { Conversation, UserBrief } from "./types";

/** The counterpart in a one-to-one chat. Null for groups — they have none. */
export function otherMember(conversation: Conversation, meId: number): UserBrief | null {
  if (conversation.type !== "direct") return null;
  return conversation.members.find((m) => m.id !== meId) ?? null;
}

export function conversationTitle(conversation: Conversation, meId: number): string {
  if (conversation.type === "direct") {
    return otherMember(conversation, meId)?.display_name ?? "Unknown";
  }
  if (conversation.name) return conversation.name;

  // An unnamed group still needs a label: list everyone but me.
  const others = conversation.members.filter((m) => m.id !== meId);
  return others.map((m) => m.display_name).join(", ") || "New group";
}

/** First name only — group previews get long fast otherwise. */
function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

/** Second line of a sidebar row. */
export function previewText(conversation: Conversation, meId: number): string {
  const message = conversation.last_message;
  if (!message) return "";

  if (message.deleted_at) return "This message was deleted";

  // System messages ("Alice added Bob") already name their subject.
  if (message.type === "system") return message.body;

  // An image with no caption still needs a line: "Photo" beats blank.
  const body = message.body || attachmentSummary(message.attachments ?? []);

  if (message.sender_id === meId) return `You: ${body}`;

  // Signal names the sender in groups, but not in a one-to-one chat where
  // there is only one other person it could be.
  if (conversation.type === "group") {
    const name = message.sender?.display_name;
    if (name) return `${firstName(name)}: ${body}`;
  }
  return body;
}

/**
 * Sidebar filtering. Matches the title or any other member's name — searching
 * "carol" should surface the group she is in, not just her direct chat.
 */
export function matchesSearch(conversation: Conversation, meId: number, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  if (conversationTitle(conversation, meId).toLowerCase().includes(term)) return true;

  // Skip myself: my name is in every conversation, so it would match all.
  return conversation.members.some(
    (m) =>
      m.id !== meId &&
      (m.display_name.toLowerCase().includes(term) || m.phone.includes(term))
  );
}

/** The chat-list filter chips. "all" is the resting state. */
export type ChatFilter = "all" | "unread" | "favorites" | "groups";

/**
 * Does this row belong under the given chip? Favourites are passed in rather
 * than read from the store, so this stays a pure function.
 */
export function matchesFilter(
  conversation: Conversation,
  filter: ChatFilter,
  favoriteIds: readonly number[]
): boolean {
  switch (filter) {
    case "unread":
      return conversation.unread_count > 0;
    case "favorites":
      return favoriteIds.includes(conversation.id);
    case "groups":
      return conversation.type === "group";
    default:
      return true;
  }
}

/**
 * How many rows each chip would show. Counted before the search term is
 * applied: the chips describe the whole list, not the current search.
 */
export function filterCounts(
  conversations: readonly Conversation[],
  favoriteIds: readonly number[]
): Record<ChatFilter, number> {
  return {
    all: conversations.length,
    unread: conversations.filter((c) => c.unread_count > 0).length,
    favorites: conversations.filter((c) => favoriteIds.includes(c.id)).length,
    groups: conversations.filter((c) => c.type === "group").length,
  };
}
