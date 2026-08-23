import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterChips } from "./FilterChips";

const counts = { all: 3, unread: 2, favorites: 0, groups: 1 };

describe("FilterChips", () => {
  it("shows a count on every chip that has one", () => {
    render(<FilterChips active="all" counts={counts} onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Unread 2" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Groups 1" })).toBeInTheDocument();
  });

  it("leaves an empty chip bare rather than showing a zero", () => {
    render(<FilterChips active="all" counts={counts} onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Favorites" })).toBeInTheDocument();
  });

  it("never counts All — it is the resting state", () => {
    render(<FilterChips active="all" counts={counts} onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
  });

  it("marks the active chip for assistive tech", () => {
    render(<FilterChips active="groups" counts={counts} onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Groups");
  });

  it("reports the chip that was clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterChips active="all" counts={counts} onChange={onChange} />);

    await user.click(screen.getByRole("tab", { name: /unread/i }));
    expect(onChange).toHaveBeenCalledWith("unread");
  });

  it("keeps chat folders visible but inert until they exist", () => {
    render(<FilterChips active="all" counts={counts} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add chat folder/i })).toBeDisabled();
  });
});
