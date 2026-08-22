import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NavRail } from "./NavRail";
import type { User } from "@/lib/types";
import { usePreferences } from "@/store/preferences";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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

describe("NavRail", () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferences.setState({ railExpanded: false });
  });

  it("is icon-only by default, with names for assistive tech", () => {
    render(<NavRail user={ME} />);
    expect(screen.getByRole("link", { name: "Chats" })).toBeInTheDocument();
    expect(screen.queryByTestId("rail-label")).not.toBeInTheDocument();
  });

  it("expands to show labels when the menu button is used", async () => {
    const user = userEvent.setup();
    render(<NavRail user={ME} />);

    await user.click(screen.getByRole("button", { name: /menu/i }));

    const labels = screen.getAllByTestId("rail-label").map((n) => n.textContent);
    expect(labels).toEqual(["Chats", "Calls", "Stories"]);
  });

  it("collapses again on a second press", async () => {
    const user = userEvent.setup();
    render(<NavRail user={ME} />);
    const menu = screen.getByRole("button", { name: /menu/i });

    await user.click(menu);
    await user.click(menu);

    expect(screen.queryByTestId("rail-label")).not.toBeInTheDocument();
  });

  it("says which state it is in", async () => {
    const user = userEvent.setup();
    render(<NavRail user={ME} />);
    const menu = screen.getByRole("button", { name: /menu/i });

    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
  });

  it("remembers the choice", async () => {
    const user = userEvent.setup();
    render(<NavRail user={ME} />);

    await user.click(screen.getByRole("button", { name: /menu/i }));

    expect(usePreferences.getState().railExpanded).toBe(true);
    expect(localStorage.getItem("signal:railExpanded")).toBe("true");
  });

  it("shows my name beside my avatar once expanded", async () => {
    const user = userEvent.setup();
    render(<NavRail user={ME} />);

    await user.click(screen.getByRole("button", { name: /menu/i }));

    expect(screen.getByText("Yash Virulkar")).toBeInTheDocument();
  });

  it("keeps the settings link reachable in both states", async () => {
    const user = userEvent.setup();
    render(<NavRail user={ME} />);

    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /menu/i }));
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });
});
