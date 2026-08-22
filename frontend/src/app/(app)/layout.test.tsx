import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AppLayout from "./layout";
import type { User } from "@/lib/types";
import { useConversations } from "@/store/conversations";
import { useSession } from "@/store/session";

const path = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => path(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// The socket is not the subject here.
vi.mock("@/hooks/useRealtime", () => ({ useRealtime: () => undefined, sendTyping: vi.fn() }));

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

const shell = () => render(<AppLayout>{<p>pane content</p>}</AppLayout>);

describe("AppLayout", () => {
  beforeEach(() => {
    path.mockReturnValue("/");
    useSession.setState({ user: ME });
    useConversations.setState({ items: [], loading: false });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })));
  });

  it("shows nothing until the session is known", () => {
    useSession.setState({ user: null });
    const { container } = shell();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  describe("on a phone", () => {
    it("offers the bottom tabs instead of the rail", () => {
      shell();
      expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    });

    it("hides the rail below the md breakpoint", () => {
      const { container } = shell();
      const railWrapper = container.querySelector(".hidden.md\\:flex");
      expect(railWrapper).not.toBeNull();
    });

    it("hides the tabs inside a conversation, as Signal does", () => {
      path.mockReturnValue("/chat");
      shell();
      expect(screen.queryByRole("navigation", { name: "Sections" })).not.toBeInTheDocument();
    });

    it("hides the tabs in settings", () => {
      path.mockReturnValue("/settings");
      shell();
      expect(screen.queryByRole("navigation", { name: "Sections" })).not.toBeInTheDocument();
    });

    it("shows the list on the chats tab and hides the pane", () => {
      const { container } = shell();
      // list visible, main hidden until md
      expect(container.querySelector(".flex.min-w-0.flex-1.md\\:flex")).not.toBeNull();
      expect(container.querySelector("section.hidden")).not.toBeNull();
    });

    it("shows the pane and hides the list once a chat is open", () => {
      path.mockReturnValue("/chat");
      const { container } = shell();
      expect(container.querySelector("section.flex")).not.toBeNull();
    });

    it("leaves room for the tab bar where it is shown", () => {
      const { container } = shell();
      expect(container.querySelector(".pb-16.md\\:pb-0")).not.toBeNull();
    });

    it("leaves no gap where the tab bar is hidden", () => {
      path.mockReturnValue("/chat");
      const { container } = shell();
      expect(container.querySelector(".pb-16")).toBeNull();
    });
  });

  describe("on a desktop", () => {
    it("keeps the rail and the sidebar", () => {
      shell();
      expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
      expect(screen.getByLabelText("Search conversations")).toBeInTheDocument();
    });

    it("drops the chat list in settings, which brings its own nav", () => {
      path.mockReturnValue("/settings");
      shell();
      expect(screen.queryByLabelText("Search conversations")).not.toBeInTheDocument();
    });

    it("sizes the sidebar 320px from md up", () => {
      const { container } = shell();
      expect(container.querySelector(".md\\:w-\\[320px\\]")).not.toBeNull();
    });
  });

  it("renders the routed pane", () => {
    shell();
    expect(screen.getByText("pane content")).toBeInTheDocument();
  });
});
