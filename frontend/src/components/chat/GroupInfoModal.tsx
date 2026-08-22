"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { CloseIcon } from "@/components/ui/icons";
import { ApiError, api } from "@/lib/api";
import type { Conversation, Member, UserBrief } from "@/lib/types";
import { useConversations } from "@/store/conversations";

type Props = {
  conversation: Conversation;
  meId: number;
  onClose: () => void;
};

export function GroupInfoModal({ conversation, meId, onClose }: Props) {
  const router = useRouter();
  const upsert = useConversations((s) => s.upsert);
  const drop = useConversations((s) => s.remove);

  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState(conversation.name ?? "");
  const [adding, setAdding] = useState(false);
  const [candidates, setCandidates] = useState<UserBrief[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const path = `/api/conversations/${conversation.id}`;

  useEffect(() => {
    api.get<Member[]>(`${path}/members`).then(setMembers).catch(() => setMembers([]));
  }, [path]);

  const iAmAdmin = members.some((m) => m.user.id === meId && m.role === "admin");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not work");
    } finally {
      setBusy(false);
    }
  }

  const removeMember = (userId: number) =>
    run(async () => {
      setMembers(await api.delete<Member[]>(`${path}/members/${userId}`));
    });

  const leave = () =>
    run(async () => {
      await api.delete(`${path}/members/${meId}`);
      drop(conversation.id);
      onClose();
      router.replace("/");
    });

  const save = () =>
    run(async () => {
      upsert(await api.patch<Conversation>(path, { name: name.trim() }));
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
      setMembers(await api.post<Member[]>(`${path}/members`, { user_ids: [userId] }));
      setCandidates((current) => current.filter((c) => c.id !== userId));
    });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Group info"
        className="w-full max-w-md overflow-hidden rounded-xl border border-edge bg-surface-2 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-body1 font-semibold text-label">Group info</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-label-2 hover:bg-surface hover:text-label"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex flex-col items-center gap-2 px-4 py-5">
          <Avatar
            name={conversation.name ?? "Group"}
            color={conversation.avatar_color}
            fg={conversation.avatar_fg}
            size={64}
          />
          {iAmAdmin ? (
            <div className="mt-2 w-full">
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
          ) : (
            <p className="text-title2 font-semibold text-label">{conversation.name}</p>
          )}
          <p className="text-body2 text-label-2">{members.length} members</p>
        </div>

        <div className="max-h-64 overflow-y-auto border-t border-edge">
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
                {m.role === "admin" && (
                  <span className="block text-caption text-label-2">Admin</span>
                )}
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

        {iAmAdmin && !adding && (
          <div className="border-t border-edge px-4 py-3">
            <button
              onClick={openAdd}
              disabled={busy}
              className="w-full rounded-full bg-surface py-2 text-body2 text-label disabled:opacity-40"
            >
              Add members
            </button>
          </div>
        )}

        {adding && (
          <div className="max-h-48 overflow-y-auto border-t border-edge py-1">
            {candidates.length === 0 ? (
              <p className="px-4 py-4 text-center text-body2 text-label-2">
                Everyone in your contacts is already here.
              </p>
            ) : (
              candidates.map((person) => (
                <button
                  key={person.id}
                  onClick={() => add(person.id)}
                  disabled={busy}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface disabled:opacity-40"
                >
                  <Avatar
                    name={person.display_name}
                    color={person.avatar_color}
                fg={person.avatar_fg}
                    url={person.avatar_url}
                    size={32}
                  />
                  <span className="min-w-0 flex-1 truncate text-body1 text-label">
                    {person.display_name}
                  </span>
                  <span className="shrink-0 text-caption text-accent">Add</span>
                </button>
              ))
            )}
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

        {error && (
          <p role="alert" className="border-t border-edge px-4 py-3 text-body2 text-[#CF163E]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
