/**
 * Display rules for a conversation. Signal's conventions live here rather than
 * in the API, so the server stays structural and these stay testable.
 */

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

  if (message.sender_id === meId) return `You: ${message.body}`;

  // Signal names the sender in groups, but not in a one-to-one chat where
  // there is only one other person it could be.
  if (conversation.type === "group") {
    const name = message.sender?.display_name;
    if (name) return `${firstName(name)}: ${message.body}`;
  }
  return message.body;
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
