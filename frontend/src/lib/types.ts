export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed" | null;

export type User = {
  id: number;
  phone: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  about: string | null;
  last_seen_at: string | null;
  created_at: string;
};

/** A person as they appear in a list, header, or member roster. */
export type UserBrief = {
  id: number;
  display_name: string;
  phone: string;
  username?: string | null;
  avatar_url: string | null;
  avatar_color: string;
  about: string | null;
  last_seen_at: string | null;
  online: boolean;
};

export type Message = {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  type: "text" | "system";
  body: string;
  reply_to_id?: number | null;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  sender?: UserBrief | null;
  /** Tick state; only present on messages I sent. */
  status?: MessageStatus;
  /** Set on an optimistic bubble until the server confirms it. */
  local_id?: string;
  /** Echoed back by the server so we can match the optimistic bubble. */
  client_id?: string | null;
};

/** A membership row: who, and what they may do. */
export type Member = {
  role: "admin" | "member";
  joined_at: string;
  last_read_message_id: number;
  user: UserBrief;
};

export type Conversation = {
  id: number;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  created_by: number | null;
  created_at: string;
  last_message_at: string;
  members: UserBrief[];
  last_message: Message | null;
  unread_count: number;
};
