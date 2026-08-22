"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PanelHeader } from "@/components/sidebar/PanelHeader";
import { Avatar } from "@/components/ui/Avatar";
import { AtIcon, GroupIcon, HashIcon, SearchIcon } from "@/components/ui/icons";
import { chatHref } from "@/hooks/useActiveConversation";
import { ApiError, api } from "@/lib/api";
import { isValidPhone, toE164 } from "@/lib/phone";
import type { Conversation, UserBrief } from "@/lib/types";

type Props = {
  onBack: () => void;
  onNewGroup: () => void;
};

const PLACEHOLDER = {
  any: "Name, username, or number",
  username: "Username",
  phone: "Phone number",
} as const;

export function NewChatPanel({ onBack, onNewGroup }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<keyof typeof PLACEHOLDER>("any");
  const [contacts, setContacts] = useState<UserBrief[]>([]);
  const [search, setSearch] = useState<{ term: string; items: UserBrief[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<UserBrief[]>("/api/contacts").then(setContacts).catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    // Debounced so typing does not fire a request per keystroke.
    const timer = setTimeout(() => {
      api
        .get<UserBrief[]>(`/api/users/search?q=${encodeURIComponent(term)}`)
        .then((items) => setSearch({ term, items }))
        .catch(() => setSearch({ term, items: [] }));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  async function startChat(person: UserBrief) {
    setBusy(true);
    setError(null);
    try {
      const conversation = await api.post<Conversation>("/api/conversations", {
        user_id: person.id,
      });
      router.push(chatHref(conversation.id));
      onBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start that chat");
    } finally {
      setBusy(false);
    }
  }

  async function addByPhone() {
    setBusy(true);
    setError(null);
    try {
      const person = await api.post<UserBrief>("/api/contacts", { phone: toE164(query) });
      setContacts((current) => [...current, person]);
      await startChat(person);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that number");
    } finally {
      setBusy(false);
    }
  }

  const term = query.trim();
  const results = search?.term === term ? search.items : null;
  const searching = term.length > 0 && results === null;
  const people = term ? (results ?? []) : contacts;
  const canAddNumber = !searching && term.length > 0 && people.length === 0 && isValidPhone(term);

  /** The two "find by" rows are shortcuts into the same search. */
  const focusSearch = (next: keyof typeof PLACEHOLDER) => {
    setMode(next);
    box.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="New chat" onBack={onBack} />

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5">
          <SearchIcon className="h-4 w-4 shrink-0 text-label-2" />
          <input
            ref={box}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={PLACEHOLDER[mode]}
            aria-label="Search for someone"
            className="w-full bg-transparent py-1 text-body2 text-label outline-none placeholder:text-label-2"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {!term && (
          <>
            <ActionRow icon={<GroupIcon />} label="New group" onClick={onNewGroup} />
            <ActionRow
              icon={<AtIcon />}
              label="Find by username"
              onClick={() => focusSearch("username")}
            />
            <ActionRow
              icon={<HashIcon />}
              label="Find by phone number"
              onClick={() => focusSearch("phone")}
            />
          </>
        )}

        {!term && contacts.length > 0 && (
          <p className="px-4 pb-1 pt-4 text-subtitle text-label-2">Contacts</p>
        )}

        {people.map((person) => (
          <button
            key={person.id}
            disabled={busy}
            onClick={() => startChat(person)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface disabled:opacity-50"
          >
            <Avatar
              name={person.display_name}
              color={person.avatar_color}
              fg={person.avatar_fg}
              url={person.avatar_url}
              size={32}
              online={person.online}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body1 text-label">{person.display_name}</span>
              {/* Two people can share a name; the number is what tells them
                  apart, so it is not optional. */}
              <span className="block truncate text-body2 text-label-2">{person.phone}</span>
            </span>
          </button>
        ))}

        {searching && (
          <p className="px-4 py-6 text-center text-body2 text-label-2">Searching…</p>
        )}

        {term && !searching && people.length === 0 && !canAddNumber && (
          <p className="px-4 py-6 text-center text-body2 text-label-2">No one found.</p>
        )}

        {canAddNumber && (
          <div className="px-4 py-4 text-center">
            <p className="mb-3 text-body2 text-label-2">Not in your contacts yet.</p>
            <button
              disabled={busy}
              onClick={addByPhone}
              className="rounded-full bg-outgoing px-5 py-2 text-body2 font-semibold text-white disabled:opacity-50"
            >
              Add {toE164(query)}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="border-t border-edge px-4 py-3 text-body2 text-[#CF163E]">
          {error}
        </p>
      )}
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-label">
        {icon}
      </span>
      <span className="text-body1 text-label">{label}</span>
    </button>
  );
}
