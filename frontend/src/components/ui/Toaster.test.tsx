import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { Toaster } from "./Toaster";
import { useToasts } from "@/store/toasts";

describe("Toaster", () => {
  beforeEach(() => useToasts.setState({ items: [] }));

  it("renders nothing when there is nothing to say", () => {
    const { container } = render(<Toaster />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces messages politely", () => {
    useToasts.setState({ items: [{ id: 1, message: "Group renamed", tone: "info" }] });
    render(<Toaster />);

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Group renamed");
  });

  it("shows several at once", () => {
    useToasts.setState({
      items: [
        { id: 1, message: "One", tone: "info" },
        { id: 2, message: "Two", tone: "info" },
      ],
    });
    render(<Toaster />);
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
  });

  it("can be dismissed by hand", async () => {
    const user = userEvent.setup();
    useToasts.setState({ items: [{ id: 1, message: "Group renamed", tone: "info" }] });
    render(<Toaster />);

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(useToasts.getState().items).toEqual([]);
  });

  it("marks an error so it reads differently", () => {
    useToasts.setState({ items: [{ id: 1, message: "Could not send", tone: "error" }] });
    render(<Toaster />);
    expect(screen.getByTestId("toast")).toHaveAttribute("data-tone", "error");
  });
});
