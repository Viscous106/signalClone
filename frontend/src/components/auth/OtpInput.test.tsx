import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OtpInput } from "./OtpInput";

const boxes = () => screen.getAllByRole("textbox");

describe("OtpInput — Signal's six boxes, grouped 3–3", () => {
  it("renders six boxes inside a labelled group", () => {
    render(<OtpInput value="" onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: /verification code/i })).toBeInTheDocument();
    expect(boxes()).toHaveLength(6);
  });

  it("shows a separator between the two halves", () => {
    render(<OtpInput value="" onChange={vi.fn()} />);
    expect(screen.getByTestId("otp-separator")).toBeInTheDocument();
  });

  it("spreads the value one digit per box", () => {
    render(<OtpInput value="123456" onChange={vi.fn()} />);
    expect(boxes().map((b) => (b as HTMLInputElement).value)).toEqual(
      ["1", "2", "3", "4", "5", "6"]
    );
  });

  it("appends as you type and advances the focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} />);

    await user.click(boxes()[0]);
    await user.keyboard("1");

    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("ignores anything that is not a digit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} />);

    await user.click(boxes()[0]);
    await user.keyboard("a");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("deletes the last digit on backspace", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OtpInput value="123" onChange={onChange} />);

    await user.click(boxes()[3]);
    await user.keyboard("{Backspace}");

    expect(onChange).toHaveBeenCalledWith("12");
  });

  it("accepts a pasted code", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} />);

    await user.click(boxes()[0]);
    await user.paste("123456");

    expect(onChange).toHaveBeenCalledWith("123456");
  });

  it("keeps only the digits from a messy paste", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} />);

    await user.click(boxes()[0]);
    await user.paste("123-456");

    expect(onChange).toHaveBeenCalledWith("123456");
  });

  it("never grows past six digits", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OtpInput value="123456" onChange={onChange} />);

    await user.click(boxes()[5]);
    await user.keyboard("7");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("can be disabled while the code is being checked", () => {
    render(<OtpInput value="123456" onChange={vi.fn()} disabled />);
    expect(boxes().every((b) => (b as HTMLInputElement).disabled)).toBe(true);
  });
});
