"use client";

import { Avatar } from "@/components/ui/Avatar";
import { usePreferences } from "@/store/preferences";
import type { User } from "@/lib/types";

import { Check, Divider, Hint, Pill, Row, SectionHeader, Select } from "./primitives";

/**
 * Section bodies, following the desktop app's rows closely.
 *
 * Most controls are placeholders, as the brief allows. Two are real because we
 * built the features behind them: Appearance → Theme, and Privacy → Read
 * receipts / Typing indicators.
 */

export function GeneralSection({ user }: { user: User }) {
  return (
    <>
      <Row title="Phone Number" control={<span className="text-body2 text-label-2">{user.phone}</span>} />
      <Row title="Device Name" control={<span className="text-body2 text-label-2">Web</span>} />
      <Hint>This demo runs in the browser, so there is no device to rename.</Hint>
      <Divider />
      <SectionHeader>System</SectionHeader>
      <Check label="Hide menu bar" checked={false} disabled />
      <Check label="Minimize to system tray" checked={false} disabled />
      <Check label="Start minimized to tray" checked={false} disabled />
      <Divider />
      <SectionHeader>Permissions</SectionHeader>
      <Check label="Allow access to the microphone" checked={false} disabled />
      <Check label="Allow access to the camera" checked={false} disabled />
    </>
  );
}

export function AppearanceSection() {
  const { theme, setTheme } = usePreferences();
  const label = { system: "System", light: "Light", dark: "Dark" }[theme];

  return (
    <>
      <Row title="Language" control={<span className="text-body2 text-label-2">System Language</span>} />
      <Row
        title="Theme"
        control={
          <Select
            label="Theme"
            value={label}
            options={["System", "Light", "Dark"]}
            onChange={(next) => setTheme(next.toLowerCase() as typeof theme)}
          />
        }
      />
      <Row
        title="Chat color"
        control={<span className="block h-5 w-5 rounded-full bg-outgoing" aria-hidden="true" />}
      />
      <Row
        title="Zoom level"
        control={<Select label="Zoom level" value="100%" options={["100%"]} disabled />}
      />
    </>
  );
}

export function ChatsSection() {
  return (
    <>
      <SectionHeader>Chats</SectionHeader>
      <Check label="Spell check text entered in message composition box" checked disabled />
      <Check label="Show text formatting popover when text is selected" checked disabled />
      <Check
        label="Generate link previews"
        description="Retrieve link previews directly from websites for messages you send."
        checked
        disabled
      />
      <Check
        label="Use address book photos"
        description="Display contact photos from your address book if available."
        checked={false}
        disabled
      />
      <Check
        label="Convert typed emoticons to emoji"
        description="For example, :-) will be converted to 🙂"
        checked
        disabled
      />
      <Check
        label="Keep muted chats archived"
        description="Muted chats that are archived will remain archived when a new message arrives."
        checked={false}
        disabled
      />
      <Divider />
      <SectionHeader>Chat folders</SectionHeader>
      <Row
        title="Add a chat folder"
        description="Organize your chats into folders and quickly switch between them on your chat list."
        control={<Pill disabled>Set up</Pill>}
      />
      <Divider />
      <Row
        title="Export chat history"
        description="Export a machine-readable JSON copy of all your chats."
        control={<Pill disabled>Export</Pill>}
      />
    </>
  );
}

export function CallsSection() {
  return (
    <>
      <SectionHeader>Calling</SectionHeader>
      <Check label="Enable incoming calls" checked disabled />
      <Check label="Play calling sounds" checked disabled />
      <Divider />
      <SectionHeader>Devices</SectionHeader>
      <p className="mb-1 mt-3 text-body2 text-label-2">Video</p>
      <Select label="Video" value="No devices available" options={["No devices available"]} disabled />
      <p className="mb-1 mt-4 text-body2 text-label-2">Microphone</p>
      <Select label="Microphone" value="Default" options={["Default"]} disabled />
      <p className="mb-1 mt-4 text-body2 text-label-2">Speakers</p>
      <Select label="Speakers" value="Default" options={["Default"]} disabled />
      <Divider />
      <SectionHeader>Advanced</SectionHeader>
      <Check
        label="Always relay calls"
        description="Relay all calls through the Signal server to avoid revealing your IP address to your contact."
        checked={false}
        disabled
      />
    </>
  );
}

export function NotificationsSection() {
  return (
    <>
      <Check label="Enable notifications" checked disabled />
      <Check label="Show notifications for calls" checked disabled />
      <Check label="Draw attention to this window when a notification arrives" checked={false} disabled />
      <Check label="Include muted chats in badge count" checked={false} disabled />
      <Divider />
      <Row
        title="Notification content"
        control={
          <Select
            label="Notification content"
            value="Name, content, and actions"
            options={["Name, content, and actions"]}
            disabled
          />
        }
      />
      <Divider />
      <Check label="Push notification sounds" checked={false} disabled />
      <Check
        label="In-chat message sounds"
        description="Hear a notification sound for sent and received messages while in the chat."
        checked={false}
        disabled
      />
      <Divider />
      <Row
        title="Notification profiles"
        description="Create a profile to receive notifications and calls only from the people and groups you choose"
        control={<Pill disabled>Set up</Pill>}
      />
    </>
  );
}

export function PrivacySection() {
  const { readReceipts, typingIndicators, setReadReceipts, setTypingIndicators } = usePreferences();

  return (
    <>
      <Row
        title="Phone Number"
        description="Choose who can see your phone number and who can contact you on Signal with it."
        control={<Pill disabled>Change…</Pill>}
      />
      <Divider />
      <Row title="Blocked" description="No users or groups" control={<Pill disabled>View</Pill>} />
      <Divider />
      <SectionHeader>Messaging</SectionHeader>
      {/* These two are real: the features behind them exist. */}
      <Check
        label="Read receipts"
        description="If disabled, you won't see read receipts from others."
        checked={readReceipts}
        onChange={setReadReceipts}
      />
      <Check
        label="Typing indicators"
        description="If disabled, you won't see typing indicators from others."
        checked={typingIndicators}
        onChange={setTypingIndicators}
      />
      <Divider />
      <SectionHeader>Disappearing messages</SectionHeader>
      <Row
        title="Default timer for new chats"
        description="Not yet available. To set a timer, open a chat and use the hourglass in its header — that applies to everyone in the conversation."
        control={<Select label="Default timer" value="Off" options={["Off"]} disabled />}
      />
      <Divider />
      <SectionHeader>Stories</SectionHeader>
      <Row
        title="Share & View Stories"
        description="If you opt out of stories you will no longer be able to share or view stories."
        control={
          <Pill tone="danger" disabled>
            Turn off stories
          </Pill>
        }
      />
      <Divider />
      <SectionHeader>Advanced</SectionHeader>
      <Check
        label="Automatic key verification"
        description="When enabled, Signal will attempt to automatically verify the encryption of 1:1 chats."
        checked
        disabled
      />
      <Divider />
      <Row
        title="Delete application data"
        description="This will delete all data in the application, removing all messages and saved account information."
        control={
          <Pill tone="danger" disabled>
            Delete data
          </Pill>
        }
      />
    </>
  );
}

export function DataUsageSection() {
  return (
    <>
      <SectionHeader>Media auto-download</SectionHeader>
      <Check label="Photos" checked disabled />
      <Check label="Videos" checked disabled />
      <Check label="Audio" checked disabled />
      <Check label="Documents" checked disabled />
      <Hint>Voice messages and stickers are always auto-downloaded.</Hint>
      <Divider />
      <Row
        title="Sent media quality"
        description="Sending high quality media will use more data."
        control={<Select label="Sent media quality" value="Standard" options={["Standard"]} disabled />}
      />
    </>
  );
}

export function BackupsSection() {
  return (
    <>
      <Hint>
        Back up your message history so you never lose data when you get a new phone or reinstall
        Signal.
      </Hint>
      <Row
        title="Signal Secure Backups"
        description="Automatic backups with Signal's secure, end-to-end encrypted storage service."
      />
      <Divider />
      <SectionHeader>Other ways to back up</SectionHeader>
      <Row
        title="Desktop backups"
        description="Create an end-to-end encrypted backup that you can restore on your phone."
        control={<Pill disabled>Set up</Pill>}
      />
    </>
  );
}

export function LinkedDevicesSection() {
  return (
    <>
      <Hint>
        Signal links a desktop app to your phone. This build is the web app, so
        there is nothing to link.
      </Hint>
      <Divider />
      <Row
        title="Link a new device"
        description="Scan a QR code from your phone to link it."
        control={<Pill disabled>Coming soon</Pill>}
      />
      <Row title="This device" description="Web · active now" />
    </>
  );
}

export function DonateSection({ user }: { user: User }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Avatar
        name={user.display_name}
        color={user.avatar_color}
        fg={user.avatar_fg}
        url={user.avatar_url}
        size={72}
      />
      <h3 className="mt-4 text-title2 font-semibold text-label">Proudly nonprofit</h3>
      <p className="mt-2 max-w-xs text-body2 text-label-2">
        Donate to support private messaging. Keep Signal independent and ad-free.
      </p>
      <span className="mt-5">
        <Pill tone="accent" disabled>
          Donate
        </Pill>
      </span>
    </div>
  );
}
