"use client";

import { useEffect, useRef, useState } from "react";

import { AttachIcon, CloseIcon } from "@/components/ui/icons";
import {
  ACCEPT,
  MAX_FILES,
  type PendingAttachment,
  formatSize,
  prepare,
} from "@/lib/attachments";
import type { Quote } from "@/lib/types";
import { useToasts } from "@/store/toasts";

type Props = {
  onSend: (body: string, attachments: PendingAttachment[]) => void;
  onTyping: (isTyping: boolean) => void;
  /** The message being replied to, if any. */
  replyTo?: Quote | null;
  onCancelReply?: () => void;
  meId?: number;
};

/** Stops broadcasting "typing" once the user has paused this long. */
const IDLE_MS = 3000;

export function Composer({ onSend, onTyping, replyTo, onCancelReply, meId }: Props) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<PendingAttachment[]>([]);
  const typingRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const notifyToast = useToasts((s) => s.show);

  // Opening a reply should put the cursor in the box ready to answer.
  useEffect(() => {
    if (replyTo) box.current?.focus();
  }, [replyTo]);

  // The parent passes an inline arrow, so `onTyping` is a new function every
  // render. Holding it in a ref lets the unmount cleanup call the current one
  // without re-running the effect on every render.
  const notify = useRef(onTyping);
  useEffect(() => {
    notify.current = onTyping;
  }, [onTyping]);

  const stopTyping = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (typingRef.current) {
      typingRef.current = false;
      notify.current(false);
    }
  };

  // Never leave the other side staring at dots after we unmount.
  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (typingRef.current) notify.current(false);
    },
    []
  );

  function handleChange(value: string) {
    setDraft(value);

    if (value && !typingRef.current) {
      typingRef.current = true;
      notify.current(true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (value) idleTimer.current = setTimeout(stopTyping, IDLE_MS);
    else stopTyping();
  }

  async function addFiles(picked: FileList | null) {
    if (!picked || picked.length === 0) return;

    const room = MAX_FILES - files.length;
    if (room <= 0) {
      notifyToast(`At most ${MAX_FILES} attachments per message`, "error");
      return;
    }

    const { ready, errors } = await prepare(Array.from(picked).slice(0, room));
    // Same file twice is a no-op rather than a duplicate chip.
    setFiles((current) => {
      const seen = new Set(current.map((f) => f.key));
      return [...current, ...ready.filter((f) => !seen.has(f.key))];
    });
    errors.forEach((message) => notifyToast(message, "error"));
    if (picker.current) picker.current.value = "";
  }

  function submit() {
    const body = draft.trim();
    // An image with no caption is a real message; empty text is not.
    if (!body && files.length === 0) return;

    onSend(body, files);
    setDraft("");
    setFiles([]);
    stopTyping();
    box.current?.focus();
  }

  const empty = !draft.trim() && files.length === 0;

  return (
    <div className="shrink-0 border-t border-edge px-4 py-2.5">
      {replyTo && (
        <div
          data-testid="reply-preview"
          className="mb-2 flex items-start gap-2 rounded-lg border-l-[3px] border-accent bg-surface-2 px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption font-semibold text-accent">
              {replyTo.sender_id === meId ? "You" : replyTo.sender_name ?? "Unknown"}
            </p>
            <p className="truncate text-body2 text-label-2">
              {replyTo.body || (replyTo.attachment_count > 0 ? "Photo" : "")}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="shrink-0 rounded-md p-1 text-label-2 hover:bg-surface hover:text-label"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <ul
          data-testid="pending-attachments"
          className="mb-2 flex flex-wrap gap-2"
        >
          {files.map((file) => (
            <li
              key={file.key}
              className="relative flex items-center gap-2 rounded-lg border border-edge bg-surface-2 p-1.5 pr-7"
            >
              {file.is_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.data_url}
                  alt={file.name}
                  className="h-11 w-11 rounded object-cover"
                />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded bg-surface text-label-2">
                  <AttachIcon className="h-5 w-5" />
                </span>
              )}
              <span className="min-w-0 max-w-40">
                <span className="block truncate text-caption text-label">{file.name}</span>
                <span className="block text-caption text-label-2">{formatSize(file.size)}</span>
              </span>
              <button
                onClick={() => setFiles((c) => c.filter((f) => f.key !== file.key))}
                aria-label={`Remove ${file.name}`}
                className="absolute right-1 top-1 rounded-full p-0.5 text-label-2 hover:bg-surface hover:text-label"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2 rounded-[18px] bg-surface-2 px-3 py-2">
        <input
          ref={picker}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => addFiles(e.target.files)}
          className="hidden"
          // Labelled rather than hidden from the tree: the test drives it, and
          // keyboard users reach it through the button below.
          aria-label="Choose files to attach"
        />
        <button
          onClick={() => picker.current?.click()}
          aria-label="Attach a file"
          title="Attach a file"
          className="mb-0.5 shrink-0 rounded-full p-1 text-label-2 hover:bg-surface hover:text-label"
        >
          <AttachIcon />
        </button>
        <textarea
          ref={box}
          rows={1}
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline, as in Signal.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message"
          aria-label="Message"
          className="max-h-32 min-h-6 w-full resize-none bg-transparent text-body1 text-label outline-none placeholder:text-label-2"
        />
        <button
          onClick={submit}
          disabled={empty}
          aria-label="Send"
          title="Send"
          className="mb-0.5 shrink-0 rounded-full bg-outgoing p-1.5 text-white transition-opacity disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
