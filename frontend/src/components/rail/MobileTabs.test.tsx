import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileTabs } from "./MobileTabs";

const pathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("MobileTabs", () => {
  it("offers the three tabs the phone app has", () => {
    render(<MobileTabs />);
    for (const label of ["Chats", "Calls", "Stories"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the current tab", () => {
    pathname.mockReturnValue("/calls");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { current: "page" })).toHaveAccessibleName("Calls");
  });

  it("treats an open chat as the Chats tab", () => {
    pathname.mockReturnValue("/chat");
    render(<MobileTabs />);
    expect(screen.getByRole("link", { current: "page" })).toHaveAccessibleName("Chats");
  });

  it("labels every tab visibly, not just by icon", () => {
    pathname.mockReturnValue("/");
    render(<MobileTabs />);
    expect(screen.getAllByTestId("tab-label").map((n) => n.textContent)).toEqual([
      "Chats",
      "Calls",
      "Stories",
    ]);
  });
});
