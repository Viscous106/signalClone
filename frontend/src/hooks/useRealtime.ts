"use client";

import { useEffect } from "react";

import type { MessageStatus } from "@/lib/types";
import { type ClientEvent, type Connection, connect } from "@/lib/ws";
import { useConversations } from "@/store/conversations";
import { useMessages } from "@/store/messages";

/**
 * The app needs exactly one socket, opened by the layout and shared by every
 * chat. Holding it at module scope keeps navigation from reconnecting and
 * saves threading a sender through context.
 */
let connection: Connection | null = null;

function send(event: ClientEvent) {
  connection?.send(event);
}

export function sendTyping(conversationId: number, isTyping: boolean) {
  send({ type: "typing", payload: { conversation_id: conversationId, is_typing: isTyping } });
}

export function useRealtime(meId: number | undefined) {
  useEffect(() => {
    if (!meId) return;

    connection = connect((event) => {
      switch (event.type) {
        case "message.new":
          useMessages.getState().applyNew(event.payload);
          useConversations.getState().applyMessage(event.payload, meId);
          break;
        case "message.status":
          useMessages
            .getState()
            .applyStatus(
              event.payload.conversation_id,
              event.payload.message_id,
              event.payload.status as MessageStatus
            );
          break;
        case "typing":
          useMessages
            .getState()
            .setTyping(event.payload.conversation_id, event.payload.user_id, event.payload.is_typing);
          break;
        case "presence":
          useConversations
            .getState()
            .applyPresence(event.payload.user_id, event.payload.online, event.payload.last_seen_at);
          break;
        default:
          break;
      }
    });

    return () => {
      connection?.close();
      connection = null;
    };
  }, [meId]);
}
