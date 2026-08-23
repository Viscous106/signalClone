"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import {
  BackIcon,
  BellIcon,
  PaletteIcon,
  SearchIcon,
  TimerOffIcon,
} from "@/components/ui/icons";
import { ApiError, api } from "@/lib/api";
import { conversationTitle, otherMember } from "@/lib/conversation";
import { DISAPPEAR_CHOICES } from "@/lib/disappearing";
import type { Conversation, Member, UserBrief } from "@/lib/types";
import { CHAT_COLORS, selectChatColor, useChatColors } from "@/store/chatColors";
import { useConversations } from "@/store/conversations";
import { useToasts } from "@/store/toasts";

/**
 * Conversation details — the pane behind the header.
 *
 * One surface for both kinds of chat: the settings rows are shared, and a group
 * adds its roster and admin controls below them. Replaces the thread rather
 * than floating over it, which is how Signal Desktop does it.
 */
export function ConversationInfo({
  conversation,
  meId,
  onBack,
}: {
  conversation: Conversation;
  meId: number;
  onBack: () => void;
}) {
  const router = useRouter();
  const upsert = useConversations((s) => s.upsert);
  const drop = useConversations((s) => s.remove);
  const notify = useToasts((s) => s.show);

  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState(conversation.name ?? "");
  const [adding, setAdding] = useState(false);
  const [candidates, setCandidates] = useState<UserBrief[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const path = `/api/conversations/${conversation.id}`;
  const isGroup = conversation.type === "group";

  useEffect(() => {
    // A direct chat has no roster to manage, so it needs no request.
    if (!isGroup) return;
    api.get<Member[]>(`${path}/members`).then(setMembers).catch(() => setMembers([]));
  }, [path, isGroup]);

  const iAmAdmin = members.some((m) => m.user.id === meId && m.role === "admin");
  // Direct chats have no admins, so both sides may set the timer.
  const canChangeTimer = !isGroup || iAmAdmin;

  const title = conversationTitle(conversation, meId);
  const counterpart = otherMember(conversation, meId);
  const timer = conversation.disappear_seconds ?? 0;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "That did not work";
      setError(message);
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  }

  const setTimer = (seconds: number) =>
    run(async () => {
      upsert(await api.patch<Conversation>(`${path}/disappearing`, { seconds }));
      notify(seconds === 0 ? "Disappearing messages off" : "Timer updated");
    });

  const removeMember = (userId: number) =>
    run(async () => {
      const who = members.find((m) => m.user.id === userId)?.user.display_name;
      setMembers(await api.delete<Member[]>(`${path}/members/${userId}`));
      notify(who ? `Removed ${who}` : "Member removed");
    });

  const leave = () =>
    run(async () => {
      await api.delete(`${path}/members/${meId}`);
      notify("You left the group");
      drop(conversation.id);
      router.replace("/");
    });

  const save = () =>
    run(async () => {
      upsert(await api.patch<Conversation>(path, { name: name.trim() }));
      notify("Group renamed");
    });

  const openAdd = () =>
    run(async () => {
      const contacts = await api.get<UserBrief[]>("/api/contacts");
      const already = new Set(members.map((m) => m.user.id));
      setCandidates(contacts.filter((c) => !already.has(c.id)));
      setAdding(true);
    });

  const add = (userId: number) =>
    run(async () => {
      const who = candidates.find((c) => c.id === userId)?.display_name;
      setMembers(await api.post<Member[]>(`${path}/members`, { user_ids: [userId] }));
      setCandidates((current) => current.filter((c) => c.id !== userId));
      notify(who ? `Added ${who}` : "Member added");
    });

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-header shrink-0 items-center gap-2 border-b border-edge px-2 md:px-4">
        <button
          onClick={onBack}
          aria-label="Back to conversation"
          className="rounded-full p-2 text-label hover:bg-surface-2"
        >
          <BackIcon />
        </button>
        <h2 className="text-body1 font-semibold text-label">
          {isGroup ? "Group info" : "Conversation info"}
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-2 px-4 py-6">
          <Avatar
            name={title}
            size={96}
            color={isGroup ? conversation.avatar_color : counterpart?.avatar_color}
            fg={isGroup ? conversation.avatar_fg : counterpart?.avatar_fg}
            url={conversation.avatar_url ?? counterpart?.avatar_url}
          />
          <p className="text-title1 text-label">{title}</p>
          <p className="text-body2 text-label-2">
            {isGroup ? `${conversation.members.length} members` : counterpart?.phone ?? ""}
          </p>

          {/* Mute and in-chat search are out of scope; kept for fidelity. */}
          <div className="mt-3 flex gap-2">
            {[
              { key: "mute", label: "Mute", node: <BellIcon /> },
              { key: "search", label: "Search", node: <SearchIcon className="h-5 w-5" /> },
            ].map(({ key, label, node }) => (
              <button
                key={key}
                disabled
                title={`${label} — coming soon`}
                aria-label={`${label} (coming soon)`}
                className="flex w-20 cursor-not-allowed flex-col items-center gap-1 rounded-lg bg-surface-2 py-2 text-caption text-label-2 opacity-60"
              >
                {node}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-xl border-t border-edge px-4">
          <Row
            icon={<TimerOffIcon />}
            title="Disappearing messages"
            description={
              isGroup
                ? "When enabled, messages sent and received in this group will disappear after they've been seen by everyone."
                : "When enabled, messages sent and received in this 1:1 chat will disappear after they've been seen."
            }
            control={
              <select
                aria-label="Disappearing messages timer"
                value={timer}
                disabled={busy || !canChangeTimer}
                onChange={(e) => setTimer(Number(e.target.value))}
                className="rounded-lg border border-edge bg-surface-2 px-2 py-1 text-body2 text-label outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {DISAPPEAR_CHOICES.map(({ seconds, label }) => (
                  <option key={seconds} value={seconds}>
                    {label}
                  </option>
                ))}
              </select>
            }
          />

          <Row
            icon={<PaletteIcon />}
            title="Chat color"
            control={<ColorPicker conversationId={conversation.id} />}
          />

          {!canChangeTimer && (
            <p className="pb-3 text-caption text-label-2">
              Only admins can change the timer for this group.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="px-4 py-2 text-center text-body2 text-[#CF163E]">
            {error}
          </p>
        )}

        {isGroup && (
          <div className="mx-auto max-w-xl">
            {iAmAdmin && (
              <div className="border-t border-edge px-4 py-3">
                <label htmlFor="rename" className="mb-1 block text-subtitle text-label-2">
                  Group name
                </label>
                <div className="flex gap-2">
                  <input
                    id="rename"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-3 py-1.5 text-body1 text-label outline-none focus:border-accent"
                  />
                  <button
                    onClick={save}
                    disabled={!name.trim() || busy || name.trim() === conversation.name}
                    className="shrink-0 rounded-full bg-surface px-4 py-1.5 text-body2 text-label disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-edge">
              {members.map((m) => (
                <div
                  key={m.user.id}
                  data-testid="member-row"
                  className="flex items-center gap-3 px-4 py-2"
                >
                  <Avatar
                    name={m.user.display_name}
                    color={m.user.avatar_color}
                    fg={m.user.avatar_fg}
                    url={m.user.avatar_url}
                    size={32}
                    online={m.user.online}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body1 text-label">
                      {m.user.display_name}
                      {m.user.id === meId && <span className="text-label-2"> (you)</span>}
                    </span>
                    <span className="block truncate text-caption text-label-2">
                      {m.role === "admin" ? `Admin · ${m.user.phone}` : m.user.phone}
                    </span>
                  </span>
                  {/* You leave rather than remove yourself. */}
                  {iAmAdmin && m.user.id !== meId && (
                    <button
                      onClick={() => removeMember(m.user.id)}
                      disabled={busy}
                      aria-label={`Remove ${m.user.display_name}`}
                      className="shrink-0 rounded-full px-3 py-1 text-caption text-label-2 hover:bg-surface hover:text-label disabled:opacity-40"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!adding &&
              (iAmAdmin ? (
                <div className="border-t border-edge px-4 py-3">
                  <button
                    onClick={openAdd}
                    disabled={busy}
                    className="w-full rounded-full bg-surface py-2 text-body2 text-label disabled:opacity-40"
                  >
                    Add members
                  </button>
                </div>
              ) : (
                /* Say why the controls are absent, rather than letting them just vanish. */
                <p
                  data-testid="admin-only-note"
                  className="border-t border-edge px-4 py-3 text-center text-caption text-label-2"
                >
                  Only admins can add or remove members, or change the group name.
                </p>
              ))}

            {adding && (
              <div className="border-t border-edge py-1">
                {candidates.length === 0 ? (
                  <p className="px-4 py-4 text-center text-body2 text-label-2">
                    Everyone in your contacts is already here.
                  </p>
                ) : (
                  candidates.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => add(c.id)}
                      disabled={busy}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface disabled:opacity-40"
                    >
                      <Avatar
                        name={c.display_name}
                        color={c.avatar_color}
                        fg={c.avatar_fg}
                        url={c.avatar_url}
                        size={32}
                      />
                      <span className="min-w-0 flex-1 truncate text-body1 text-label">
                        {c.display_name}
                      </span>
                    </button>
                  ))
                )}
                <div className="px-4 py-2">
                  <button
                    onClick={() => setAdding(false)}
                    className="w-full rounded-full bg-surface py-2 text-body2 text-label"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-edge px-4 py-3">
              <button
                onClick={leave}
                disabled={busy}
                className="w-full rounded-full py-2 text-body2 text-[#CF163E] hover:bg-surface disabled:opacity-40"
              >
                Leave group
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** One settings line: icon, label, optional blurb, control on the right. */
function Row({
  icon,
  title,
  description,
  control,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 shrink-0 text-label-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-body1 text-label">{title}</span>
        {description && <span className="block text-body2 text-label-2">{description}</span>}
      </span>
      <span className="shrink-0">{control}</span>
    </div>
  );
}

function ColorPicker({ conversationId }: { conversationId: number }) {
  const current = useChatColors(selectChatColor(conversationId));
  const setColor = useChatColors((s) => s.set);
  const [open, setOpen] = useState(false);

  const active = CHAT_COLORS.find((c) => c.value === current) ?? CHAT_COLORS[0];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label={`Chat color: ${active.label}`}
        title={active.label}
        className="h-5 w-5 rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-label-2"
        style={{ backgroundColor: current }}
      />
    );
  }

  return (
    <div role="radiogroup" aria-label="Chat color" className="grid max-w-40 grid-cols-6 gap-1.5">
      {CHAT_COLORS.map((color) => (
        <button
          key={color.id}
          role="radio"
          aria-checked={color.value === current}
          aria-label={color.label}
          title={color.label}
          onClick={() => {
            setColor(conversationId, color.value);
            setOpen(false);
          }}
          className={`h-5 w-5 rounded-full ${
            color.value === current ? "ring-2 ring-label ring-offset-1 ring-offset-surface" : ""
          }`}
          style={{ backgroundColor: color.value }}
        />
      ))}
    </div>
  );
}
