"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar } from "@/components/ui/Avatar";
import { CallIcon, ChatIcon, StoryIcon } from "@/components/ui/icons";
import type { User } from "@/lib/types";

const TABS = [
  { href: "/", label: "Chats", Icon: ChatIcon, match: (p: string) => p === "/" || p.startsWith("/chat") },
  { href: "/calls", label: "Calls", Icon: CallIcon, match: (p: string) => p.startsWith("/calls") },
  { href: "/stories", label: "Stories", Icon: StoryIcon, match: (p: string) => p.startsWith("/stories") },
];

/** Signal's 80px icon rail. Calls and Stories are placeholders. */
export function NavRail({ user }: { user: User }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex w-rail shrink-0 flex-col items-center justify-between border-r border-edge bg-surface-2 py-4"
    >
      <div className="flex flex-col items-center gap-2">
        <button
          aria-label="Menu"
          title="Menu — coming soon"
          className="flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-lg text-label-2 opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>

        <ul className="flex flex-col items-center gap-2">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                title={label}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
                  active ? "bg-surface text-label" : "text-label-2 hover:bg-surface hover:text-label"
                }`}
              >
                <Icon />
              </Link>
            </li>
          );
        })}
        </ul>
      </div>

      <Link
        href="/settings"
        title="Settings"
        aria-label="Settings"
        aria-current={pathname.startsWith("/settings") ? "page" : undefined}
        className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
          pathname.startsWith("/settings") ? "bg-surface" : "hover:bg-surface"
        }`}
      >
        <Avatar
          name={user.display_name}
          color={user.avatar_color}
          fg={user.avatar_fg}
          url={user.avatar_url}
          size={32}
        />
      </Link>
    </nav>
  );
}
