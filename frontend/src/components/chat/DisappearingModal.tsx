"use client";

import { useState } from "react";

import { CloseIcon } from "@/components/ui/icons";
import { ApiError, api } from "@/lib/api";
import { DISAPPEAR_CHOICES } from "@/lib/disappearing";
import type { Conversation } from "@/lib/types";
import { useConversations } from "@/store/conversations";
import { useToasts } from "@/store/toasts";

/**
 * The timer picker.
 *
 * Conversation-wide rather than per-person: everyone in the thread gets the
 * same duration, and the change announces itself as a system message.
 */
export function DisappearingModal({
  conversation,
  canChange,
  onClose,
}: {
  conversation: Conversation;
  canChange: boolean;
  onClose: () => void;
}) {
  const upsert = useConversations((s) => s.upsert);
  const notify = useToasts((s) => s.show);
  const [busy, setBusy] = useState(false);
  const current = conversation.disappear_seconds ?? 0;

  async function choose(seconds: number) {
    if (seconds === current) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const updated = await api.patch<Conversation>(
        `/api/conversations/${conversation.id}/disappearing`,
        { seconds }
      );
      upsert(updated);
      notify(seconds === 0 ? "Disappearing messages off" : "Timer updated");
      onClose();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "That did not work", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Disappearing messages"
        className="w-full max-w-sm overflow-hidden rounded-xl border border-edge bg-surface-2 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-body1 font-semibold text-label">Disappearing messages</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-label-2 hover:bg-surface hover:text-label"
          >
            <CloseIcon />
          </button>
        </header>

        <p className="px-4 py-3 text-body2 text-label-2">
          New messages in this chat will disappear after they are sent. Messages already sent are
          not affected.
        </p>

        <div role="radiogroup" aria-label="Timer" className="max-h-72 overflow-y-auto border-t border-edge">
          {DISAPPEAR_CHOICES.map(({ seconds, label }) => (
            <button
              key={seconds}
              role="radio"
              aria-checked={seconds === current}
              disabled={busy || !canChange}
              onClick={() => choose(seconds)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-body1 text-label hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              {label}
              {seconds === current && (
                <span aria-hidden="true" className="text-accent">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>

        {!canChange && (
          <p className="border-t border-edge px-4 py-3 text-center text-caption text-label-2">
            Only admins can change the timer for this group.
          </p>
        )}
      </div>
    </div>
  );
}
