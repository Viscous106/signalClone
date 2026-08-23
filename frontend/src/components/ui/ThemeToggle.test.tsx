import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeMenuItem, ThemeToggle } from "./ThemeToggle";
import { usePreferences } from "@/store/preferences";

const state = (over: Partial<ReturnType<typeof usePreferences.getState>> = {}) => {
  usePreferences.setState({ theme: "dark", systemPrefersDark: false, ...over });
};

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    state();
  });

  it("offers light when the screen is dark", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("offers dark when the screen is light", () => {
    state({ theme: "light" });
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });

  it("switches, and the choice sticks", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /switch to light/i }));
    expect(usePreferences.getState().theme).toBe("light");
    expect(localStorage.getItem("signal:theme")).toBe("light");
  });

  it("puts the class the design tokens key off on the document", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /switch to light/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("goes back again", async () => {
    const user = userEvent.setup();
    state({ theme: "light" });
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /switch to dark/i }));
    expect(usePreferences.getState().theme).toBe("dark");
  });

  describe("starting from System", () => {
    it("commits to light when the system is dark", async () => {
      const user = userEvent.setup();
      state({ theme: "system", systemPrefersDark: true });
      render(<ThemeToggle />);

      // A toggle should invert what you are looking at, not what is stored.
      await user.click(screen.getByRole("button", { name: /switch to light/i }));
      expect(usePreferences.getState().theme).toBe("light");
    });

    it("commits to dark when the system is light", async () => {
      const user = userEvent.setup();
      state({ theme: "system", systemPrefersDark: false });
      render(<ThemeToggle />);

      await user.click(screen.getByRole("button", { name: /switch to dark/i }));
      expect(usePreferences.getState().theme).toBe("dark");
    });
  });

  it("names the mode beside the icon once the rail is expanded", () => {
    render(<ThemeToggle expanded />);
    expect(screen.getByTestId("theme-label")).toHaveTextContent("Light mode");
  });

  it("is icon-only while the rail is collapsed", () => {
    render(<ThemeToggle />);
    expect(screen.queryByTestId("theme-label")).not.toBeInTheDocument();
  });
});

describe("ThemeMenuItem", () => {
  beforeEach(() => {
    localStorage.clear();
    state();
  });

  it("is a menu row naming the mode it switches to", () => {
    render(<ThemeMenuItem />);
    expect(screen.getByRole("menuitem", { name: /light mode/i })).toBeInTheDocument();
  });

  it("switches and closes the menu behind it", async () => {
    const user = userEvent.setup();
    let closed = false;
    render(<ThemeMenuItem onDone={() => (closed = true)} />);

    await user.click(screen.getByRole("menuitem"));
    expect(usePreferences.getState().theme).toBe("light");
    expect(closed).toBe(true);
  });

  it("agrees with the rail button about which way it goes", () => {
    state({ theme: "light" });
    const { unmount } = render(<ThemeMenuItem />);
    expect(screen.getByRole("menuitem", { name: /dark mode/i })).toBeInTheDocument();
    unmount();

    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
  });
});
