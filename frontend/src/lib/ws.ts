/**
 * WebSocket client.
 *
 * In production the API serves the frontend, so this is a same-origin socket
 * and the session cookie is sent as a matter of course. In development the two
 * run on separate ports; cookies ignore port, so that works too.
 */

import type { Conversation, Message, Reaction } from "./types";

export type ServerEvent =
  | { type: "ready"; payload: { user_id: number } }
  | { type: "pong"; payload: Record<string, never> }
  | { type: "message.new"; payload: Message }
  | {
      type: "message.status";
      payload: { message_id: number; conversation_id: number; status: string };
    }
  | {
      type: "message.reactions";
      payload: { message_id: number; conversation_id: number; reactions: Reaction[] };
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
  // An explicit override is only needed when the API is on another host.
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window === "undefined") return "";

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // Served by the API itself, so the socket lives on this very origin. In
  // development `next dev` runs separately, hence the port hint.
  const host =
    process.env.NODE_ENV === "production" ? window.location.host : "localhost:8000";
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
