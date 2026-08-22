"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar } from "@/components/ui/Avatar";
import { CallIcon, ChatIcon, StoryIcon } from "@/components/ui/icons";
import type { User } from "@/lib/types";
import { usePreferences } from "@/store/preferences";

const TABS = [
  { href: "/", label: "Chats", Icon: ChatIcon, match: (p: string) => p === "/" || p.startsWith("/chat") },
  { href: "/calls", label: "Calls", Icon: CallIcon, match: (p: string) => p.startsWith("/calls") },
  { href: "/stories", label: "Stories", Icon: StoryIcon, match: (p: string) => p.startsWith("/stories") },
];

/**
 * Signal's icon rail. The hamburger widens it to show labels beside the
 * icons — the same toggle the desktop app has.
 */
export function NavRail({ user }: { user: User }) {
  const pathname = usePathname();
  const expanded = usePreferences((s) => s.railExpanded);
  const toggleRail = usePreferences((s) => s.toggleRail);

  const onSettings = pathname.startsWith("/settings");

  return (
    <nav
      aria-label="Main"
      className={`flex shrink-0 flex-col justify-between border-r border-edge bg-surface-2 py-4 transition-[width] duration-150 ${
        expanded ? "w-[200px] px-3" : "w-rail items-center"
      }`}
    >
      <div className={`flex flex-col gap-2 ${expanded ? "" : "items-center"}`}>
        <button
          onClick={toggleRail}
          aria-label="Menu"
          aria-expanded={expanded}
          title={expanded ? "Collapse" : "Expand"}
          className={`flex h-12 items-center rounded-lg text-label-2 transition-colors hover:bg-surface hover:text-label ${
            expanded ? "w-full gap-3 px-3" : "w-12 justify-center"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>

        <ul className={`flex flex-col gap-2 ${expanded ? "" : "items-center"}`}>
          {TABS.map(({ href, label, Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href} className={expanded ? "w-full" : ""}>
                <Link
                  href={href}
                  title={label}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 items-center rounded-lg transition-colors ${
                    active ? "bg-surface text-label" : "text-label-2 hover:bg-surface hover:text-label"
                  } ${expanded ? "w-full gap-3 px-3" : "w-12 justify-center"}`}
                >
                  <span className="shrink-0">
                    <Icon />
                  </span>
                  {expanded && (
                    <span data-testid="rail-label" className="truncate text-body2">
                      {label}
                    </span>
                  )}
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
        aria-current={onSettings ? "page" : undefined}
        className={`flex h-12 items-center rounded-lg transition-colors ${
          onSettings ? "bg-surface" : "hover:bg-surface"
        } ${expanded ? "w-full gap-3 px-3" : "w-12 justify-center"}`}
      >
        <span className="shrink-0">
          <Avatar
            name={user.display_name}
            color={user.avatar_color}
            fg={user.avatar_fg}
            url={user.avatar_url}
            size={28}
          />
        </span>
        {expanded && (
          <span className="min-w-0 truncate text-body2 text-label">{user.display_name}</span>
        )}
      </Link>
    </nav>
  );
}
