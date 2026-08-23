import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EncryptionNotice } from "./EncryptionNotice";

describe("EncryptionNotice", () => {
  it("carries Signal's own line about the thread", () => {
    render(<EncryptionNotice />);
    expect(screen.getByText(/end-to-end encrypted/i)).toBeInTheDocument();
  });

  it("says the encryption is simulated, so nobody is misled", () => {
    // Claiming real cryptography in a clone would be a false security promise.
    render(<EncryptionNotice />);
    expect(screen.getByText(/simulated/i)).toBeInTheDocument();
  });

  it("is decorative to a screen reader beyond its text", () => {
    const { container } = render(<EncryptionNotice />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
