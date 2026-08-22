import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "./page";
import type { User } from "@/lib/types";
import { usePreferences } from "@/store/preferences";
import { useSession } from "@/store/session";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const ME: User = {
  id: 1,
  phone: "+919834758028",
  username: null,
  display_name: "Yash Virulkar",
  avatar_url: null,
  avatar_color: "#FEF5D0",
  avatar_fg: "#836B01",
  about: null,
  last_seen_at: null,
  created_at: "2026-08-22T09:00:00Z",
};

describe("SettingsPage", () => {
  beforeEach(() => {
    replace.mockClear();
    localStorage.clear();
    document.documentElement.className = "dark";
    useSession.setState({ user: ME });
    usePreferences.setState({ theme: "dark", readReceipts: true, typingIndicators: true });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
  });

  it("shows the app's own settings sections, in order", () => {
    render(<SettingsPage />);
    const labels = [
      "General",
      "Appearance",
      "Chats",
      "Calls",
      "Notifications",
      "Privacy",
      "Data usage",
      "Backups",
      "Linked devices",
      "Donate to Signal",
    ];
    for (const label of labels) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("opens on the profile, with the signed-in identity", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    // The nav card and the editor both show the identity.
    expect(screen.getAllByText("+919834758028").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/your name/i)).toHaveValue("Yash Virulkar");
  });

  it("switches section and retitles the pane", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Privacy" }));
    expect(screen.getByRole("heading", { name: "Privacy" })).toBeInTheDocument();
  });

  it("carries the two privacy toggles we actually implement", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: "Privacy" }));

    const receipts = screen.getByRole("checkbox", { name: /read receipts/i });
    const typing = screen.getByRole("checkbox", { name: /typing indicators/i });
    expect(receipts).toBeChecked();
    expect(typing).toBeChecked();
    expect(receipts).toBeEnabled();

    await user.click(receipts);
    expect(usePreferences.getState().readReceipts).toBe(false);
  });

  it("really changes the theme from Appearance", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: "Appearance" }));

    await user.selectOptions(screen.getByLabelText("Theme"), "Light");

    expect(usePreferences.getState().theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("marks placeholder controls as disabled rather than pretending", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByRole("checkbox", { name: /enable notifications/i })).toBeDisabled();
  });

  it("carries the Linked devices placeholder the brief asks for", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Linked devices" }));

    expect(screen.getByRole("heading", { name: "Linked devices" })).toBeInTheDocument();
    expect(screen.getByText(/link a new device/i)).toBeInTheDocument();
  });

  it("logs out and returns to the login screen", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(useSession.getState().user).toBeNull();
  });
});
