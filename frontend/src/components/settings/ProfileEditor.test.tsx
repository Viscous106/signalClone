import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileEditor } from "./ProfileEditor";
import type { User } from "@/lib/types";
import { useSession } from "@/store/session";

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

function mockPatch(response: Partial<User> = {}) {
  const calls: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string | URL, init?: RequestInit) => {
      calls.push(init?.body ? JSON.parse(String(init.body)) : undefined);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...ME, ...response }),
      } as Response;
    })
  );
  return calls;
}

describe("ProfileEditor", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    useSession.setState({ user: ME });
  });

  it("shows the current name and phone", () => {
    mockPatch();
    render(<ProfileEditor user={ME} />);
    expect(screen.getByLabelText(/your name/i)).toHaveValue("Yash Virulkar");
    expect(screen.getByText("+919834758028")).toBeInTheDocument();
  });

  it("cannot save an empty name", async () => {
    const user = userEvent.setup();
    mockPatch();
    render(<ProfileEditor user={ME} />);

    await user.clear(screen.getByLabelText(/your name/i));
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("has nothing to save until something changes", () => {
    mockPatch();
    render(<ProfileEditor user={ME} />);
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("saves a new name and updates the session", async () => {
    const user = userEvent.setup();
    const calls = mockPatch({ display_name: "Yash V" });
    render(<ProfileEditor user={ME} />);

    await user.clear(screen.getByLabelText(/your name/i));
    await user.type(screen.getByLabelText(/your name/i), "Yash V");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(useSession.getState().user?.display_name).toBe("Yash V"));
    expect(calls[0]).toMatchObject({ display_name: "Yash V" });
  });

  it("saves an about line", async () => {
    const user = userEvent.setup();
    const calls = mockPatch({ about: "Building things" });
    render(<ProfileEditor user={ME} />);

    await user.type(screen.getByLabelText(/about/i), "Building things");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(calls[0]).toMatchObject({ about: "Building things" }));
  });

  it("lets me set a photo by URL", async () => {
    const user = userEvent.setup();
    const calls = mockPatch({ avatar_url: "https://example.test/me.png" });
    render(<ProfileEditor user={ME} />);

    await user.type(screen.getByLabelText(/photo/i), "https://example.test/me.png");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(calls[0]).toMatchObject({ avatar_url: "https://example.test/me.png" })
    );
  });

  it("can clear a photo back to initials", async () => {
    const user = userEvent.setup();
    const withPhoto = { ...ME, avatar_url: "https://example.test/old.png" };
    useSession.setState({ user: withPhoto });
    const calls = mockPatch({ avatar_url: null });
    render(<ProfileEditor user={withPhoto} />);

    await user.clear(screen.getByLabelText(/photo/i));
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(calls[0]).toMatchObject({ avatar_url: null }));
  });
})
