"use client";

import { useEffect, useRef, useState } from "react";

import { messageTime } from "@/lib/format";
import type { Message, Quote } from "@/lib/types";
import { ReactIcon, ReplyIcon, TimerIcon } from "@/components/ui/icons";

import { AttachmentView } from "./AttachmentView";
import { ReactionPills, ReactionTray } from "./ReactionBar";
import { StatusTicks } from "./StatusTicks";

type Props = {
  message: Message;
  outgoing: boolean;
  groupStart: boolean;
  groupEnd: boolean;
  showSender: boolean;
  /** The conversation's outgoing bubble colour. */
  chatColor?: string;
  onReply?: (quote: Quote) => void;
  onReact?: (messageId: number, emoji: string) => void;
};

/** The quoted snippet above a reply. Clicking it jumps to the original. */
function QuoteBlock({ quote, outgoing }: { quote: Quote; outgoing: boolean }) {
  const preview = quote.deleted_at
    ? "This message was deleted"
    : quote.body || (quote.attachment_count > 0 ? "Photo" : "");

  return (
    <button
      data-testid="bubble-quote"
      onClick={() => {
        document
          .getElementById(`message-${quote.id}`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      }}
      className={`mb-1.5 block w-full rounded-md border-l-[3px] px-2 py-1 text-left ${
        outgoing
          ? "border-white/60 bg-black/15"
          : "border-accent bg-black/10 dark:bg-white/10"
      }`}
    >
      <span className="block truncate text-caption font-semibold opacity-90">
        {quote.sender_name ?? "Unknown"}
      </span>
      <span className={`block truncate text-body2 opacity-80 ${quote.deleted_at ? "italic" : ""}`}>
        {preview}
      </span>
    </button>
  );
}

/**
 * Whole seconds left, ticking, so the countdown is honest.
 *
 * A ticking clock in state and the remainder *derived* from it, rather than
 * writing the remainder into state on every change — one source of truth, and
 * no setState during an effect body.
 */
function useSecondsLeft(expiresAt: string | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [expiresAt]);

  if (!expiresAt) return null;
  return Math.max(0, Math.round((Date.parse(expiresAt) - now) / 1000));
}

/** "8h", "5m", "42s" — compact enough to sit beside the timestamp. */
function shortDuration(seconds: number): string {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

/**
 * Signal's bubble. The details that make it recognisable: 18px radius, a hard
 * 306px cap rather than a percentage, and the inner corner of a run tightening
 * to 4px.
 */
export function MessageBubble({
  message,
  outgoing,
  groupStart,
  groupEnd,
  showSender,
  chatColor,
  onReply,
  onReact,
}: Props) {
  const [trayOpen, setTrayOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const secondsLeft = useSecondsLeft(message.expires_at);

  useEffect(() => {
    if (!trayOpen) return;
    const away = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setTrayOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTrayOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [trayOpen]);

  const corners = outgoing
    ? `${groupStart ? "rounded-tr-[18px]" : "rounded-tr-[4px]"} ${
        groupEnd ? "rounded-br-[18px]" : "rounded-br-[4px]"
      }`
    : `${groupStart ? "rounded-tl-[18px]" : "rounded-tl-[4px]"} ${
        groupEnd ? "rounded-bl-[18px]" : "rounded-bl-[4px]"
      }`;

  const timerSeconds = message.expire_seconds ?? 0;
  const attachments = message.attachments ?? [];
  const reactions = message.reactions ?? [];
  // A deleted message can be neither answered nor reacted to.
  const actionable = !message.deleted_at && (onReply || onReact);

  const quoteFromThis = (): Quote => ({
    id: message.id,
    sender_id: message.sender_id,
    body: message.body,
    deleted_at: message.deleted_at ?? null,
    sender_name: message.sender?.display_name ?? null,
    attachment_count: attachments.length,
  });

  return (
    <div
      // Anchored so a quote of this message can scroll to it.
      id={`message-${message.id}`}
      ref={wrapper}
      className={`group relative flex items-center gap-1 ${
        outgoing ? "justify-end" : "justify-start"
      } ${groupEnd && reactions.length === 0 ? "mb-1.5" : "mb-0.5"}`}
    >
      {/* Actions sit outside the bubble, on the side the reply comes from. */}
      {actionable && outgoing && (
        <Actions
          onReply={onReply ? () => onReply(quoteFromThis()) : undefined}
          onReact={onReact ? () => setTrayOpen((v) => !v) : undefined}
        />
      )}

      <div className="relative flex max-w-[min(306px,72%)] flex-col">
        <div
          // 306px is Signal's actual cap — a percentage looks wrong when wide.
          // The colour is a per-conversation choice, so it comes in as a
          // style rather than a class: Tailwind cannot enumerate it.
          style={outgoing && chatColor ? { backgroundColor: chatColor } : undefined}
          className={`rounded-[18px] px-3 py-2 ${corners} ${
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

          {message.quote && !message.deleted_at && (
            <QuoteBlock quote={message.quote} outgoing={outgoing} />
          )}

          {!message.deleted_at && (
            <AttachmentView
              attachments={attachments}
              outgoing={outgoing}
              hasCaption={Boolean(message.body)}
            />
          )}

          {/* An attachment with no caption needs no empty paragraph. */}
          {(message.body || message.deleted_at || attachments.length === 0) && (
            <p data-testid="bubble-body" className="whitespace-pre-wrap break-words text-body1">
              {message.deleted_at ? (
                <span className="italic opacity-70">This message was deleted</span>
              ) : (
                message.body
              )}
            </p>
          )}

          {groupEnd && (
            <span
              className={`mt-[3px] flex items-center justify-end gap-1 text-caption ${
                outgoing ? "text-label-oncolor/70" : "text-label-2"
              }`}
            >
              {secondsLeft !== null ? (
                <span
                  data-testid="bubble-expiry"
                  title={`Disappears in ${shortDuration(secondsLeft)}`}
                  className="flex items-center gap-0.5"
                >
                  <TimerIcon className="h-3 w-3" />
                  {shortDuration(secondsLeft)}
                </span>
              ) : (
                // Carries a timer but nobody has read it yet, so there is no
                // countdown to show — just that one is waiting.
                timerSeconds > 0 && (
                  <span
                    data-testid="bubble-timer-pending"
                    title={`Disappears ${shortDuration(timerSeconds)} after it is read`}
                    className="flex items-center gap-0.5 opacity-60"
                  >
                    <TimerIcon className="h-3 w-3" />
                    {shortDuration(timerSeconds)}
                  </span>
                )
              )}
              <span data-testid="bubble-time">{messageTime(message.created_at)}</span>
              {outgoing && <StatusTicks status={message.status ?? null} />}
            </span>
          )}
        </div>

        {trayOpen && onReact && (
          <ReactionTray
            onPick={(emoji) => {
              onReact(message.id, emoji);
              setTrayOpen(false);
            }}
          />
        )}

        <div className={outgoing ? "flex justify-end" : "flex justify-start"}>
          <ReactionPills
            reactions={reactions}
            onToggle={(emoji) => onReact?.(message.id, emoji)}
          />
        </div>
      </div>

      {actionable && !outgoing && (
        <Actions
          onReply={onReply ? () => onReply(quoteFromThis()) : undefined}
          onReact={onReact ? () => setTrayOpen((v) => !v) : undefined}
        />
      )}
    </div>
  );
}

/**
 * Reply and react, revealed on hover.
 *
 * `focus-within` as well as `hover`, so the buttons are reachable by keyboard —
 * hover-only actions are invisible to anyone tabbing through.
 */
function Actions({ onReply, onReact }: { onReply?: () => void; onReact?: () => void }) {
  return (
    // Always visible on a touch screen — there is no hover to reveal them —
    // and hover-revealed from `md` up, which is where a pointer exists.
    // focus-within too, so tabbing reaches them either way.
    <div className="flex shrink-0 items-center gap-0.5 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
      {onReact && (
        <button
          onClick={onReact}
          aria-label="React"
          title="React"
          className="rounded-full p-1 text-label-2 hover:bg-surface-2 hover:text-label"
        >
          <ReactIcon />
        </button>
      )}
      {onReply && (
        <button
          onClick={onReply}
          aria-label="Reply"
          title="Reply"
          className="rounded-full p-1 text-label-2 hover:bg-surface-2 hover:text-label"
        >
          <ReplyIcon />
        </button>
      )}
    </div>
  );
}
