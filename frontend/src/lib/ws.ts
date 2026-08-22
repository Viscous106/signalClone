/**
 * WebSocket client.
 *
 * Next's rewrites do not proxy WebSockets, so this connects to the API
 * directly. Authentication rides on the session cookie: cookies ignore port,
 * so :3000 → :8000 works in development. A cross-domain deployment needs the
 * API on a sibling subdomain for the cookie to be sent.
 */

import type { Conversation, Message } from "./types";

export type ServerEvent =
  | { type: "ready"; payload: { user_id: number } }
  | { type: "pong"; payload: Record<string, never> }
  | { type: "message.new"; payload: Message }
  | {
      type: "message.status";
      payload: { message_id: number; conversation_id: number; status: string };
    }
  | {
      type: "typing";
      payload: { conversation_id: number; user_id: number; is_typing: boolean };
    }
  | {
      type: "presence";
      payload: { user_id: number; online: boolean; last_seen_at?: string };
    }
  | { type: "conversation.updated"; payload: Conversation }
  | { type: "conversation.removed"; payload: { conversation_id: number } };

export type ClientEvent =
  | { type: "ping"; payload: Record<string, never> }
  | { type: "typing"; payload: { conversation_id: number; is_typing: boolean } };

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 10_000;

function socketUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window === "undefined") return "";

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // In development the API is on its own port; in production assume it is
  // reachable on the same host behind a proxy.
  const host = process.env.NODE_ENV === "production" ? window.location.host : "localhost:8000";
  return `${protocol}//${host}/ws`;
}

export type Connection = {
  send: (event: ClientEvent) => void;
  close: () => void;
};

export function connect(onEvent: (event: ServerEvent) => void): Connection {
  let socket: WebSocket | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let closedByUs = false;

  const send = (event: ClientEvent) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  };

  const open = () => {
    socket = new WebSocket(socketUrl());

    socket.onopen = () => {
      attempt = 0;
      heartbeat = setInterval(() => send({ type: "ping", payload: {} }), HEARTBEAT_MS);
    };

    socket.onmessage = (raw) => {
      try {
        onEvent(JSON.parse(raw.data) as ServerEvent);
      } catch {
        // Ignore anything that is not our JSON.
      }
    };

    socket.onclose = () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      if (closedByUs) return;
      // Exponential backoff, capped, so a server restart is ridden out.
      const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** attempt++);
      retry = setTimeout(open, delay);
    };

    socket.onerror = () => socket?.close();
  };

  open();

  return {
    send,
    close: () => {
      closedByUs = true;
      if (heartbeat) clearInterval(heartbeat);
      if (retry) clearTimeout(retry);
      socket?.close();
    },
  };
}
