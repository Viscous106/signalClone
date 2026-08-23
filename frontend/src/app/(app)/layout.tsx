"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { MobileTabs } from "@/components/rail/MobileTabs";
import { NavRail } from "@/components/rail/NavRail";
import { Toaster } from "@/components/ui/Toaster";
import { useRealtime } from "@/hooks/useRealtime";
import { useUnreadTitle } from "@/hooks/useUnreadTitle";
import { mobilePane, showsChatList, showsTabBar } from "@/lib/shell";
import { usePreferences } from "@/store/preferences";
import { useFavorites } from "@/store/favorites";
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

  // Theme and favourites live in localStorage, which the server cannot read.
  const hydratePreferences = usePreferences((s) => s.hydrate);
  const hydrateFavorites = useFavorites((s) => s.hydrate);
  useEffect(() => {
    hydratePreferences();
    hydrateFavorites();
  }, [hydratePreferences, hydrateFavorites]);

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

  // Calls, Stories and Settings each own the whole content area.
  const chatList = showsChatList(pathname);
  // A phone has room for exactly one pane; the other is hidden until `md`.
  const primary = mobilePane(pathname);
  const tabBar = showsTabBar(pathname);
  const paneRoom = tabBar ? "pb-16 md:pb-0" : "";

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* The rail is a desktop affordance; phones get the bottom tabs. */}
      <div className="hidden md:flex">
        <NavRail user={user} />
      </div>

      {chatList && (
        <div
          className={`${primary === "list" ? "flex" : "hidden"} min-w-0 flex-1 md:flex md:flex-none ${paneRoom}`}
        >
          <SidebarSlot meId={user.id} />
        </div>
      )}

      <section
        className={`${primary === "main" ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex ${paneRoom}`}
      >
        {children}
      </section>

      {tabBar && <MobileTabs />}
      <Toaster />
    </div>
  );
}
