"use client";

import { useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/Avatar";
import { api } from "@/lib/api";
import { useSession } from "@/store/session";

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser } = useSession();

  async function logout() {
    await api.post("/api/auth/logout");
    setUser(null);
    router.replace("/login");
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg px-8 py-10">
      <h1 className="text-title1 font-semibold text-label">Settings</h1>

      <div className="mt-8 flex items-center gap-4 rounded-xl border border-edge bg-surface-2 p-4">
        <Avatar name={user.display_name} color={user.avatar_color} url={user.avatar_url} size={64} />
        <div className="min-w-0">
          <p className="truncate text-title2 font-semibold text-label">{user.display_name}</p>
          <p className="text-body2 text-label-2">{user.phone}</p>
          {user.about && <p className="mt-1 truncate text-body2 text-label-2">{user.about}</p>}
        </div>
      </div>

      <ul className="mt-6 divide-y divide-[color:var(--border-primary)] overflow-hidden rounded-xl border border-edge bg-surface-2">
        {["Account", "Appearance", "Privacy", "Notifications", "Linked devices"].map((row) => (
          <li key={row} className="flex items-center justify-between px-4 py-3">
            <span className="text-body1 text-label">{row}</span>
            <span className="text-caption uppercase tracking-wide text-label-2">Coming soon</span>
          </li>
        ))}
      </ul>

      <button
        onClick={logout}
        className="mt-8 w-full rounded-full border border-edge py-2.5 text-body1 text-[#CF163E] hover:bg-surface-2"
      >
        Log out
      </button>
    </div>
  );
}
