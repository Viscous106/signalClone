"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CallIcon, ChatIcon, StoryIcon } from "@/components/ui/icons";
import { sectionFor } from "@/lib/shell";

const TABS = [
  { href: "/", label: "Chats", section: "chats", Icon: ChatIcon },
  { href: "/calls", label: "Calls", section: "calls", Icon: CallIcon },
  { href: "/stories", label: "Stories", section: "stories", Icon: StoryIcon },
] as const;

/**
 * The phone app's bottom tab bar: icon over label, with a pill behind the
 * active icon. Replaces the desktop rail below the `md` breakpoint.
 */
export function MobileTabs() {
  const pathname = usePathname();
  const current = sectionFor(pathname);

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-edge bg-surface-2 md:hidden"
    >
      {TABS.map(({ href, label, section, Icon }) => {
        // An open conversation still belongs to the Chats tab.
        const active = current === section || (section === "chats" && current === "chat");
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 pt-1"
          >
            <span
              className={`flex h-7 w-14 items-center justify-center rounded-full ${
                active ? "bg-surface text-label" : "text-label-2"
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span
              data-testid="tab-label"
              className={`text-caption ${active ? "text-label" : "text-label-2"}`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
