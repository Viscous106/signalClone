"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MobileTabs } from "@/components/rail/MobileTabs";
import { NavRail } from "@/components/rail/NavRail";
import { ShortcutsModal } from "@/components/ui/ShortcutsModal";
import { useThemeSwitch } from "@/components/ui/ThemeToggle";
import { Toaster } from "@/components/ui/Toaster";
import { useRealtime } from "@/hooks/useRealtime";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useUnreadTitle } from "@/hooks/useUnreadTitle";
import { mobilePane, showsChatList, showsTabBar } from "@/lib/shell";
import { usePreferences } from "@/store/preferences";
import { useConversations } from "@/store/conversations";
import { useChatColors } from "@/store/chatColors";
import { useFavorites } from "@/store/favorites";
import { SidebarSlot } from "@/components/sidebar/SidebarSlot";
import { loadCurrentUser } from "@/lib/session";
import { useSession } from "@/store/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser } = useSession();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const conversations = useConversations((s) => s.items);
  const { toggle: toggleTheme } = useThemeSwitch();

  /** Alt+↑/↓ walks the sidebar in the order it is displayed. */
  const step = useCallback(
    (delta: number) => {
      if (conversations.length === 0) return;
      const current = new URLSearchParams(window.location.search).get("c");
      const index = conversations.findIndex((c) => String(c.id) === current);
      // Nowhere yet: ↓ opens the top of the list, ↑ opens the bottom.
      const next =
        index === -1
          ? delta > 0
            ? 0
            : conversations.length - 1
          : (index + delta + conversations.length) % conversations.length;
      router.push(`/chat?c=${conversations[next].id}`);
    },
    [conversations, router]
  );

  const handlers = useMemo(
    () => ({
      help: () => setShowShortcuts((open) => !open),
      search: () => {
        // The search box owns focus; the shortcut only points at it.
        const box = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search conversations"]'
        );
        box?.focus();
        box?.select();
      },
      "new-chat": () => {
        router.push("/");
        document.querySelector<HTMLButtonElement>('button[aria-label="New chat"]')?.click();
      },
      settings: () => router.push("/settings"),
      theme: toggleTheme,
      "next-chat": () => step(1),
      "previous-chat": () => step(-1),
      close: () => {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        // Escape in the search box clears it before it does anything else.
        const box = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search conversations"]'
        );
        if (document.activeElement === box && box?.value) {
          box.value = "";
          box.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }
        if (pathname.startsWith("/chat")) router.push("/");
      },
    }),
    [router, step, showShortcuts, pathname, toggleTheme]
  );

  useShortcuts(handlers);

  // One socket for the whole app, opened as soon as we know who we are.
  useRealtime(user?.id);
  useUnreadTitle();

  // Theme and favourites live in localStorage, which the server cannot read.
  const hydratePreferences = usePreferences((s) => s.hydrate);
  const hydrateFavorites = useFavorites((s) => s.hydrate);
  const hydrateChatColors = useChatColors((s) => s.hydrate);
  useEffect(() => {
    hydratePreferences();
    hydrateFavorites();
    hydrateChatColors();
  }, [hydratePreferences, hydrateFavorites, hydrateChatColors]);

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
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      <Toaster />
    </div>
  );
}
