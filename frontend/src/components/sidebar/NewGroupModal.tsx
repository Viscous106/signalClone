"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { ApiError, api } from "@/lib/api";
import type { Conversation, UserBrief } from "@/lib/types";

/** Choose people, then name the group — Signal's two-step order. */
type Step = "members" | "name";

export function NewGroupModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("members");
  const [contacts, setContacts] = useState<UserBrief[]>([]);
  const [chosen, setChosen] = useState<UserBrief[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<UserBrief[]>("/api/contacts").then(setContacts).catch(() => setContacts([]));
  }, []);

  const toggle = (person: UserBrief) =>
    setChosen((current) =>
      current.some((p) => p.id === person.id)
        ? current.filter((p) => p.id !== person.id)
        : [...current, person]
    );

  const term = query.trim().toLowerCase();
  const visible = term
    ? contacts.filter((c) => c.display_name.toLowerCase().includes(term))
    : contacts;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const group = await api.post<Conversation>("/api/conversations", {
        name: name.trim(),
        member_ids: chosen.map((p) => p.id),
      });
      router.push(`/chat/${group.id}`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New group"
        className="w-full max-w-md overflow-hidden rounded-xl border border-edge bg-surface-2 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 className="text-body1 font-semibold text-label">
            {step === "members" ? "New group" : "Name this group"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-label-2 hover:bg-surface hover:text-label"
          >
            <CloseIcon />
          </button>
        </header>

        {step === "members" ? (
          <>
            {chosen.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-edge px-4 py-2">
                {chosen.map((person) => (
                  <button
                    key={person.id}
                    data-testid="selected-pill"
                    onClick={() => toggle(person)}
                    className="flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-caption text-label"
                  >
                    {person.display_name.split(/\s+/)[0]}
                    <span aria-hidden="true" className="text-label-2">
                      ×
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="px-4 py-3">
              <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                <SearchIcon className="h-4 w-4 shrink-0 text-label-2" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search contacts"
                  aria-label="Search contacts"
                  className="w-full bg-transparent text-body2 text-label outline-none placeholder:text-label-2"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto pb-2">
              {visible.length === 0 ? (
                <p className="px-4 py-6 text-center text-body2 text-label-2">No contacts found.</p>
              ) : (
                visible.map((person) => {
                  const selected = chosen.some((p) => p.id === person.id);
                  return (
                    <button
                      key={person.id}
                      onClick={() => toggle(person)}
                      aria-pressed={selected}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface"
                    >
                      <Avatar
                        name={person.display_name}
                        color={person.avatar_color}
                        url={person.avatar_url}
                        size={36}
                      />
                      <span className="min-w-0 flex-1 truncate text-body1 text-label">
                        {person.display_name}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          selected ? "border-accent bg-accent text-white" : "border-edge"
                        }`}
                      >
                        {selected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <footer className="flex items-center justify-between border-t border-edge px-4 py-3">
              <span className="text-body2 text-label-2">
                {chosen.length === 0 ? "Choose people" : `${chosen.length} selected`}
              </span>
              <button
                onClick={() => setStep("name")}
                disabled={chosen.length === 0}
                className="rounded-full bg-outgoing px-5 py-2 text-body2 font-semibold text-white disabled:opacity-40"
              >
                Next
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="px-4 py-4">
              <label htmlFor="group-name" className="mb-1 block text-subtitle text-label-2">
                Group name
              </label>
              <input
                id="group-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Weekend Trip"
                className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-body1 text-label outline-none focus:border-accent"
              />
              <p className="mt-3 text-body2 text-label-2">
                {chosen.length + 1} members, including you
              </p>
            </div>

            <footer className="flex items-center justify-between border-t border-edge px-4 py-3">
              <button
                onClick={() => setStep("members")}
                className="text-body2 text-label-2 hover:text-label"
              >
                Back
              </button>
              <button
                onClick={create}
                disabled={!name.trim() || busy}
                className="rounded-full bg-outgoing px-5 py-2 text-body2 font-semibold text-white disabled:opacity-40"
              >
                Create
              </button>
            </footer>
          </>
        )}

        {error && (
          <p role="alert" className="border-t border-edge px-4 py-3 text-body2 text-[#CF163E]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
