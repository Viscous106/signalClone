"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onSend: (body: string) => void;
  onTyping: (isTyping: boolean) => void;
};

/** Stops broadcasting "typing" once the user has paused this long. */
const IDLE_MS = 3000;

export function Composer({ onSend, onTyping }: Props) {
  const [draft, setDraft] = useState("");
  const typingRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

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

  function submit() {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft("");
    stopTyping();
    box.current?.focus();
  }

  return (
    <div className="shrink-0 border-t border-edge px-4 py-2.5">
      <div className="flex items-end gap-2 rounded-[18px] bg-surface-2 px-3 py-2">
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
          disabled={!draft.trim()}
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
