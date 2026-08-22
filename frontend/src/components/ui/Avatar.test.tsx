import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("shows initials on the pale fill with the strong foreground", () => {
    const { container } = render(
      <Avatar name="Yash Virulkar" color="#FEF5D0" fg="#836B01" />
    );
    const circle = container.querySelector("[data-testid='avatar-initials']") as HTMLElement;

    expect(circle).toHaveTextContent("YV");
    // Signal never puts white initials on a saturated circle.
    expect(circle.style.backgroundColor).toBe("rgb(254, 245, 208)");
    expect(circle.style.color).toBe("rgb(131, 107, 1)");
  });

  it("falls back to a neutral pair when none is given", () => {
    const { container } = render(<Avatar name="Nobody" />);
    const circle = container.querySelector("[data-testid='avatar-initials']") as HTMLElement;
    expect(circle.style.backgroundColor).toBeTruthy();
    expect(circle.style.color).toBeTruthy();
  });

  it("prefers a photo when there is one", () => {
    render(<Avatar name="Alice Chen" url="https://example.test/a.png" />);
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "https://example.test/a.png");
  });

  it("marks presence only when online", () => {
    const { container: on } = render(<Avatar name="A B" online />);
    const { container: off } = render(<Avatar name="A B" />);
    expect(on.querySelector("[data-testid='online-dot']")).not.toBeNull();
    expect(off.querySelector("[data-testid='online-dot']")).toBeNull();
  });

  it("scales the initials with the circle", () => {
    const { container } = render(<Avatar name="A B" size={64} />);
    const circle = container.querySelector("[data-testid='avatar-initials']") as HTMLElement;
    expect(circle.style.fontSize).toBe("26px");
  });
});
