"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { ApiError, api } from "@/lib/api";
import { isValidPhone, toE164 } from "@/lib/phone";
import type { Conversation, UserBrief } from "@/lib/types";

export function NewChatModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<UserBrief[]>([]);
  // Results are stamped with the term they belong to, so a stale response
  // cannot be shown against newer input — and so the effect never has to
  // synchronously reset state.
  const [search, setSearch] = useState<{ term: string; items: UserBrief[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      router.push(`/chat/${conversation.id}`);
      onClose();
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
  // Only offer "add" once the search has actually come back empty.
  const canAddNumber = !searching && term.length > 0 && people.length === 0 && isValidPhone(term);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New chat"
        className="w-full max-w-md overflow-hidden rounded-xl border border-edge bg-surface-2 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-body1 font-semibold text-label">New chat</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-label-2 hover:bg-surface hover:text-label"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
            <SearchIcon className="h-4 w-4 shrink-0 text-label-2" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or phone number"
              aria-label="Search for someone"
              className="w-full bg-transparent text-body2 text-label outline-none placeholder:text-label-2"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto pb-2">
          {!term && contacts.length > 0 && (
            <p className="px-4 py-1 text-caption font-semibold uppercase tracking-wide text-label-2">
              Contacts
            </p>
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
                url={person.avatar_url}
                size={36}
                online={person.online}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body1 text-label">{person.display_name}</span>
                <span className="block truncate text-body2 text-label-2">
                  {person.about || person.phone}
                </span>
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
    </div>
  );
}
