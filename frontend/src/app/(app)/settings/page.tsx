"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AppearanceSection,
  BackupsSection,
  LinkedDevicesSection,
  CallsSection,
  ChatsSection,
  DataUsageSection,
  DonateSection,
  GeneralSection,
  NotificationsSection,
  PrivacySection,
  ProfileSection,
} from "@/components/settings/sections";
import { Avatar } from "@/components/ui/Avatar";
import { api } from "@/lib/api";
import { useSession } from "@/store/session";

type SectionId =
  | "profile"
  | "general"
  | "appearance"
  | "chats"
  | "calls"
  | "notifications"
  | "privacy"
  | "data"
  | "backups"
  | "devices"
  | "donate";

const NAV: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <GearIcon /> },
  { id: "appearance", label: "Appearance", icon: <ContrastIcon /> },
  { id: "chats", label: "Chats", icon: <BubbleIcon /> },
  { id: "calls", label: "Calls", icon: <PhoneIcon /> },
  { id: "notifications", label: "Notifications", icon: <BellIcon /> },
  { id: "privacy", label: "Privacy", icon: <LockIcon /> },
  { id: "data", label: "Data usage", icon: <PieIcon /> },
  { id: "backups", label: "Backups", icon: <ClockIcon /> },
  { id: "devices", label: "Linked devices", icon: <DeviceIcon /> },
  { id: "donate", label: "Donate to Signal", icon: <HeartIcon /> },
];

const TITLES: Record<SectionId, string> = {
  profile: "Profile",
  general: "General",
  appearance: "Appearance",
  chats: "Chats",
  calls: "Calls",
  notifications: "Notifications",
  privacy: "Privacy",
  data: "Data usage",
  backups: "Backups",
  devices: "Linked devices",
  donate: "Donate to Signal",
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser } = useSession();
  const [section, setSection] = useState<SectionId>("profile");

  async function logout() {
    await api.post("/api/auth/logout");
    setUser(null);
    router.replace("/login");
  }

  if (!user) return null;

  return (
    // Settings replaces the conversation list, but keeps the rail.
    <div className="flex h-full">
      <nav
        aria-label="Settings"
        className="flex w-[320px] shrink-0 flex-col border-r border-edge bg-surface-2"
      >
        <header className="flex h-header shrink-0 items-center px-4">
          <h1 className="text-title2 font-semibold text-label">Settings</h1>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <button
            onClick={() => setSection("profile")}
            aria-current={section === "profile" ? "page" : undefined}
            className={`mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
              section === "profile" ? "bg-surface" : "hover:bg-surface"
            }`}
          >
            <Avatar
              name={user.display_name}
              color={user.avatar_color}
              fg={user.avatar_fg}
              url={user.avatar_url}
              size={40}
            />
            <span className="min-w-0">
              <span className="block truncate text-body2 font-semibold text-label">
                {user.display_name}
              </span>
              <span className="block truncate text-subtitle text-label-2">{user.phone}</span>
            </span>
          </button>

          {NAV.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              aria-current={section === id ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-body2 ${
                section === id ? "bg-surface text-label" : "text-label hover:bg-surface"
              }`}
            >
              <span className="shrink-0 text-label-2">{icon}</span>
              {label}
            </button>
          ))}

          <button
            onClick={logout}
            className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-body2 text-[#F0868F] hover:bg-surface"
          >
            <span className="shrink-0">
              <ExitIcon />
            </span>
            Log out
          </button>
        </div>
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <h2 className="py-3 text-center text-body2 font-semibold text-label">{TITLES[section]}</h2>
        {/* A centred column, roughly the width the desktop app uses. */}
        <div className="mx-auto max-w-[600px] px-6 pb-16">
          {section === "profile" && <ProfileSection user={user} />}
          {section === "general" && <GeneralSection user={user} />}
          {section === "appearance" && <AppearanceSection />}
          {section === "chats" && <ChatsSection />}
          {section === "calls" && <CallsSection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "privacy" && <PrivacySection />}
          {section === "data" && <DataUsageSection />}
          {section === "backups" && <BackupsSection />}
          {section === "devices" && <LinkedDevicesSection />}
          {section === "donate" && <DonateSection user={user} />}
        </div>
      </div>
    </div>
  );
}

/* Inline icons, matching the app's outline style. */
const S = "h-[18px] w-[18px]";
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7 } as const;

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.3-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z" />
    </svg>
  );
}
function ContrastIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18a9 9 0 0 0 0-18Z" fill="currentColor" />
    </svg>
  );
}
function BubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.9 8.9 0 0 1-3.8-.8L3 21l1.9-5.1A8.3 8.3 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" strokeLinejoin="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinejoin="round" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
function PieIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9h9" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7C19 15.6 12 20 12 20Z" strokeLinejoin="round" />
    </svg>
  );
}
function DeviceIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <rect x="2" y="5" width="13" height="10" rx="1.5" />
      <path d="M4.5 19h8" strokeLinecap="round" />
      <rect x="17" y="9" width="5" height="10" rx="1.5" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg viewBox="0 0 24 24" className={S} {...stroke}>
      <path d="M15 17l5-5-5-5M20 12H9M11 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
