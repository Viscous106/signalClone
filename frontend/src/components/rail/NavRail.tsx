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

      <Link href="/settings" title="Settings" aria-label="Settings">
        <Avatar
          name={user.display_name}
          color={user.avatar_color}
          url={user.avatar_url}
          size={32}
        />
      </Link>
    </nav>
  );
}
