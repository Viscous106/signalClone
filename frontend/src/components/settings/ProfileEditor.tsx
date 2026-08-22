"use client";

import { useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { ApiError, api } from "@/lib/api";
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
        <Avatar
          name={name || user.display_name}
          color={user.avatar_color}
          fg={user.avatar_fg}
          url={photo.trim() || null}
          size={80}
        />
        <p className="mt-2 text-body2 text-label-2">{user.phone}</p>
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

        <div>
          <label htmlFor="profile-photo" className="mb-1 block text-subtitle text-label-2">
            Profile photo
          </label>
          <input
            id="profile-photo"
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
            placeholder="https://…"
            className={field}
          />
          <Hint>Leave this empty to use your initials.</Hint>
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
