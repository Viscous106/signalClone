import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignalGlyph, SignalLockup } from "./SignalMark";

describe("SignalGlyph", () => {
  it("is decorative on its own", () => {
    const { container } = render(<SignalGlyph />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("takes its colour from the surrounding text", () => {
    const { container } = render(<SignalGlyph />);
    // currentColor lets the same mark be brand-blue on the login screen and
    // near-white in the empty chat pane.
    expect(container.innerHTML).toContain("currentColor");
  });

  it("scales", () => {
    const { container } = render(<SignalGlyph size={96} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "96");
    expect(svg).toHaveAttribute("height", "96");
  });

  it("keeps the dashed ring that makes the mark recognisable", () => {
    const { container } = render(<SignalGlyph />);
    expect(container.querySelector("[stroke-dasharray]")).not.toBeNull();
  });
});

describe("SignalLockup", () => {
  it("reads as 'Signal' to a screen reader, once", () => {
    render(<SignalLockup />);
    expect(screen.getByRole("img", { name: "Signal" })).toBeInTheDocument();
  });

  it("shows the wordmark alongside the glyph", () => {
    render(<SignalLockup />);
    expect(screen.getByText("Signal")).toBeInTheDocument();
  });

  it("can hide the wordmark for tight spaces", () => {
    render(<SignalLockup wordmark={false} />);
    expect(screen.queryByText("Signal")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Signal" })).toBeInTheDocument();
  });
});
