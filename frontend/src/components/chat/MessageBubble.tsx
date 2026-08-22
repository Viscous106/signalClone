import { messageTime } from "@/lib/format";
import type { Message } from "@/lib/types";

import { StatusTicks } from "./StatusTicks";

type Props = {
  message: Message;
  outgoing: boolean;
  groupStart: boolean;
  groupEnd: boolean;
  showSender: boolean;
};

/**
 * Signal's bubble. The details that make it recognisable: 18px radius, a hard
 * 306px cap rather than a percentage, and the inner corner of a run tightening
 * to 4px.
 */
export function MessageBubble({ message, outgoing, groupStart, groupEnd, showSender }: Props) {
  const corners = outgoing
    ? `${groupStart ? "rounded-tr-[18px]" : "rounded-tr-[4px]"} ${
        groupEnd ? "rounded-br-[18px]" : "rounded-br-[4px]"
      }`
    : `${groupStart ? "rounded-tl-[18px]" : "rounded-tl-[4px]"} ${
        groupEnd ? "rounded-bl-[18px]" : "rounded-bl-[4px]"
      }`;

  return (
    <div className={`flex ${outgoing ? "justify-end" : "justify-start"} ${groupEnd ? "mb-1.5" : "mb-0.5"}`}>
      <div
        // 306px is Signal's actual cap — a percentage looks wrong when wide.
        className={`max-w-[min(306px,72%)] rounded-[18px] px-3 py-2 ${corners} ${
          outgoing ? "bg-outgoing text-label-oncolor" : "bg-incoming text-label"
        }`}
      >
        {showSender && message.sender && (
          <p
            data-testid="bubble-sender"
            className="mb-0.5 text-body2 font-semibold"
            style={{ color: outgoing ? undefined : message.sender.avatar_color }}
          >
            {message.sender.display_name}
          </p>
        )}

        <p data-testid="bubble-body" className="whitespace-pre-wrap break-words text-body1">
          {message.deleted_at ? (
            <span className="italic opacity-70">This message was deleted</span>
          ) : (
            message.body
          )}
        </p>

        {groupEnd && (
          <span
            className={`mt-[3px] flex items-center justify-end gap-1 text-caption ${
              outgoing ? "text-label-oncolor/70" : "text-label-2"
            }`}
          >
            <span data-testid="bubble-time">{messageTime(message.created_at)}</span>
            {outgoing && <StatusTicks status={message.status ?? null} />}
          </span>
        )}
      </div>
    </div>
  );
}
