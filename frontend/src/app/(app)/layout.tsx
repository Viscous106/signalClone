"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { NavRail } from "@/components/rail/NavRail";
import { useRealtime } from "@/hooks/useRealtime";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { loadCurrentUser } from "@/lib/session";
import { useSession } from "@/store/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const { user, setUser } = useSession();

  // One socket for the whole app, opened as soon as we know who we are.
  useRealtime(user?.id);

  useEffect(() => {
    // The cookie survives reloads but the store does not, so rehydrate the
    // session from the server on mount. `user` is the only state we need:
    // either it gets set, or we have already redirected away.
    if (user) return;

    let cancelled = false;
    loadCurrentUser().then((me) => {
      if (cancelled) return;
      if (me) setUser(me);
      else router.replace("/login");
    });
    return () => {
      cancelled = true;
    };
  }, [user, setUser, router]);

  if (!user) {
    return <div className="h-screen bg-surface" aria-busy="true" />;
  }

  // Settings takes over the whole window, as it does in Signal.
  const chrome = !pathname.startsWith("/settings");
  const activeId = params?.id ? Number(params.id) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <NavRail user={user} />
      {chrome && <Sidebar meId={user.id} activeId={activeId} />}
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
