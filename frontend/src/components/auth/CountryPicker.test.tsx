import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CountryPicker } from "./CountryPicker";

describe("CountryPicker", () => {
  it("shows the common countries first, as Signal does", () => {
    render(<CountryPicker onPick={vi.fn()} onClose={vi.fn()} />);
    const names = screen.getAllByTestId("country-name").map((n) => n.textContent);
    expect(names.slice(0, 5)).toEqual([
      "United States",
      "Germany",
      "India",
      "Netherlands",
      "Ukraine",
    ]);
  });

  it("shows each dial code", () => {
    render(<CountryPicker onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("+91")).toBeInTheDocument();
  });

  it("filters as I search by name", async () => {
    const user = userEvent.setup();
    render(<CountryPicker onPick={vi.fn()} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/search/i), "germ");
    const names = screen.getAllByTestId("country-name").map((n) => n.textContent);
    expect(names).toEqual(["Germany"]);
  });

  it("filters by dial code too", async () => {
    const user = userEvent.setup();
    render(<CountryPicker onPick={vi.fn()} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/search/i), "+380");
    expect(screen.getAllByTestId("country-name").map((n) => n.textContent)).toEqual(["Ukraine"]);
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    render(<CountryPicker onPick={vi.fn()} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/search/i), "zzzz");
    expect(screen.getByText(/no countries/i)).toBeInTheDocument();
  });

  it("returns the country I choose", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<CountryPicker onPick={onPick} onClose={vi.fn()} />);

    await user.click(screen.getByText("India"));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ code: "IN", dial: "+91" }));
  });

  it("closes on the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CountryPicker onPick={vi.fn()} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
