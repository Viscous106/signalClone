"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { NavRail } from "@/components/rail/NavRail";
import { Toaster } from "@/components/ui/Toaster";
import { useRealtime } from "@/hooks/useRealtime";
import { useUnreadTitle } from "@/hooks/useUnreadTitle";
import { usePreferences } from "@/store/preferences";
import { SidebarSlot } from "@/components/sidebar/SidebarSlot";
import { loadCurrentUser } from "@/lib/session";
import { useSession } from "@/store/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser } = useSession();

  // One socket for the whole app, opened as soon as we know who we are.
  useRealtime(user?.id);
  useUnreadTitle();

  // Theme lives in localStorage, which the server cannot read.
  const hydratePreferences = usePreferences((s) => s.hydrate);
  useEffect(() => {
    hydratePreferences();
  }, [hydratePreferences]);

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

  // Settings brings its own nav pane, so the chat list steps aside.
  const chrome = !pathname.startsWith("/settings");

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <NavRail user={user} />
      {chrome && <SidebarSlot meId={user.id} />}
      <section className="min-w-0 flex-1">{children}</section>
      <Toaster />
    </div>
  );
}
