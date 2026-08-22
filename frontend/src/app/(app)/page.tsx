"use client";

import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { initials } from "@/lib/format";
import { useSession } from "@/store/session";

export default function Home() {
  const router = useRouter();
  const { user, setUser } = useSession();

  async function logout() {
    await api.post("/api/auth/logout");
    setUser(null);
    router.replace("/login");
  }

  if (!user) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full text-title1 font-medium text-white"
        style={{ backgroundColor: user.avatar_color }}
      >
        {initials(user.display_name)}
      </div>
      <div className="text-center">
        <p className="text-title2 font-semibold text-label">{user.display_name}</p>
        <p className="text-body2 text-label-2">{user.phone}</p>
      </div>
      <p className="mt-2 text-body2 text-label-2">Signed in. The chat list arrives in Phase 2.</p>
      <button
        onClick={logout}
        className="mt-4 rounded-full border border-edge px-5 py-2 text-body2 text-label hover:bg-surface-2"
      >
        Log out
      </button>
    </main>
  );
}
