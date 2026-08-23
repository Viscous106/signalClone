"use client";

import { useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { ApiError, api } from "@/lib/api";
import { fileToAvatar } from "@/lib/avatar";
import type { User } from "@/lib/types";
import { useSession } from "@/store/session";
import { useToasts } from "@/store/toasts";

import { Hint, Pill } from "./primitives";

const field =
  "w-full rounded-lg border border-edge bg-surface px-3 py-2 text-body2 text-label " +
  "outline-none placeholder:text-label-2 focus:border-accent";

/**
 * Editing your own profile. The brief asks for a display name *and* a profile
 * avatar to be settable; there is no file storage in this build, so the photo
 * is given as a URL and falls back to initials when empty.
 */
export function ProfileEditor({ user }: { user: User }) {
  const setUser = useSession((s) => s.setUser);
  const notify = useToasts((s) => s.show);

  const [name, setName] = useState(user.display_name);
  const [about, setAbout] = useState(user.about ?? "");
  const [photo, setPhoto] = useState(user.avatar_url ?? "");
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      // Cropped and shrunk here, so the server never handles an upload.
      setPhoto(await fileToAvatar(file));
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not read that image", "error");
    } finally {
      setBusy(false);
    }
  }

  const changed =
    name.trim() !== user.display_name ||
    about.trim() !== (user.about ?? "") ||
    photo.trim() !== (user.avatar_url ?? "");

  async function save() {
    setBusy(true);
    try {
      const updated = await api.patch<User>("/api/users/me", {
        display_name: name.trim(),
        about: about.trim() || null,
        avatar_url: photo.trim() || null,
      });
      setUser(updated);
      notify("Profile updated");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not save your profile", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center pb-6">
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={busy}
          aria-label="Change profile photo"
          className="group relative rounded-full disabled:opacity-60"
        >
          <Avatar
            name={name || user.display_name}
            color={user.avatar_color}
            fg={user.avatar_fg}
            url={photo.trim() || null}
            size={88}
          />
          <span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center rounded-b-full bg-black/55 text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          </span>
        </button>

        {/* accept=image/* opens the camera or gallery on a phone. */}
        <input
          ref={picker}
          type="file"
          accept="image/*"
          aria-label="Profile photo"
          className="hidden"
          onChange={(e) => choosePhoto(e.target.files?.[0])}
        />

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={busy}
            className="text-body2 text-accent hover:underline disabled:opacity-50"
          >
            {photo ? "Change photo" : "Add photo"}
          </button>
          {photo && (
            <button
              type="button"
              onClick={() => setPhoto("")}
              disabled={busy}
              className="text-body2 text-label-2 hover:text-label disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        <p className="mt-1 text-body2 text-label-2">{user.phone}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="profile-name" className="mb-1 block text-subtitle text-label-2">
            Your name
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label htmlFor="profile-about" className="mb-1 block text-subtitle text-label-2">
            About
          </label>
          <input
            id="profile-about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Write a few words about yourself"
            className={field}
          />
        </div>

        <div className="flex justify-end">
          <Pill onClick={save} disabled={!changed || !name.trim() || busy}>
            Save
          </Pill>
        </div>
      </div>

      <Hint>
        Your profile and changes to it will be visible to people you message, contacts and groups.
      </Hint>
    </>
  );
}
