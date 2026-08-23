"use client";

import { useEffect, useRef } from "react";

import { buildRows } from "@/lib/messages";
import type { Message, Quote } from "@/lib/types";

import { EncryptionNotice } from "./EncryptionNotice";
import { MessageBubble } from "./MessageBubble";

type Props = {
  messages: Message[];
  meId: number;
  isGroup: boolean;
  onReply?: (quote: Quote) => void;
  onReact?: (messageId: number, emoji: string) => void;
};

/** `messages` must be oldest first. */
export function MessageList({ messages, meId, isGroup, onReply, onReact }: Props) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Jump to the newest message, the way a chat should open.
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4">
        <EncryptionNotice />
        <p className="text-body2 text-label-2">No messages yet. Say hello.</p>
      </div>
    );
  }

  const rows = buildRows(messages, meId);

  return (
    <div className="flex flex-col px-4 py-3">
      {/* Signal opens every thread with this. */}
      <EncryptionNotice />

      {rows.map((row) =>
        row.kind === "divider" ? (
          <div key={row.key} className="my-3 flex justify-center">
            <span
              data-testid="date-divider"
              className="rounded-full bg-surface-2 px-3 py-1 text-caption uppercase tracking-wide text-label-2"
            >
              {row.label}
            </span>
          </div>
        ) : row.message.type === "system" ? (
          <p
            key={row.key}
            data-testid="system-notice"
            className="my-2 text-center text-body2 text-label-2"
          >
            {row.message.body}
          </p>
        ) : (
          <MessageBubble
            key={row.key}
            message={row.message}
            outgoing={row.outgoing}
            groupStart={row.groupStart}
            groupEnd={row.groupEnd}
            // Only the first bubble of a run is labelled, and never in a 1:1.
            showSender={isGroup && !row.outgoing && row.groupStart}
            onReply={onReply}
            onReact={onReact}
          />
        )
      )}
      <div ref={bottom} />
    </div>
  );
}
