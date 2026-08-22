import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusTicks } from "./StatusTicks";

describe("StatusTicks — Signal's single/double check experience", () => {
  it("shows nothing for an incoming message", () => {
    const { container } = render(<StatusTicks status={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels each state for assistive tech", () => {
    for (const [status, label] of [
      ["sending", /sending/i],
      ["sent", /sent/i],
      ["delivered", /delivered/i],
      ["read", /read/i],
    ] as const) {
      const { unmount } = render(<StatusTicks status={status} />);
      expect(screen.getByLabelText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("fills the checks only once read, which is what distinguishes it", () => {
    const { container: delivered } = render(<StatusTicks status="delivered" />);
    const { container: read } = render(<StatusTicks status="read" />);
    expect(delivered.querySelector("[data-filled='true']")).toBeNull();
    expect(read.querySelector("[data-filled='true']")).not.toBeNull();
  });

  it("shows a failure affordance when a send did not land", () => {
    render(<StatusTicks status="failed" />);
    expect(screen.getByLabelText(/not sent|failed/i)).toBeInTheDocument();
  });
});
