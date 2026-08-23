import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { Composer } from "./Composer";
import type { Quote } from "@/lib/types";

// jsdom fires neither load nor error for a data URI.
beforeAll(() => {
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      naturalWidth = 800;
      naturalHeight = 600;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
  );
});

const png = () => new File(["bytes"], "beach.png", { type: "image/png" });

describe("sending", () => {
  it("refuses an empty message", async () => {
    render(<Composer onSend={vi.fn()} onTyping={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("hands over the text with no attachments", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={vi.fn()} />);

    await user.type(screen.getByLabelText("Message"), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("hello", []);
  });
});

describe("attachments", () => {
  it("enables Send on an attachment alone, with no text", async () => {
    const user = userEvent.setup();
    render(<Composer onSend={vi.fn()} onTyping={vi.fn()} />);

    await user.upload(screen.getByLabelText("Choose files to attach"), png());
    // findByRole would match the button that is already there and still
    // disabled; wait for the chip that proves the file landed.
    await screen.findByTestId("pending-attachments");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("shows a chip for what is queued", async () => {
    const user = userEvent.setup();
    render(<Composer onSend={vi.fn()} onTyping={vi.fn()} />);

    await user.upload(screen.getByLabelText("Choose files to attach"), png());
    expect(await screen.findByTestId("pending-attachments")).toHaveTextContent("beach.png");
  });

  it("hands the files to onSend", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onTyping={vi.fn()} />);

    await user.upload(screen.getByLabelText("Choose files to attach"), png());
    await screen.findByTestId("pending-attachments");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const [, files] = onSend.mock.calls[0];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("beach.png");
  });

  it("lets a queued file be removed again", async () => {
    const user = userEvent.setup();
    render(<Composer onSend={vi.fn()} onTyping={vi.fn()} />);

    await user.upload(screen.getByLabelText("Choose files to attach"), png());
    await user.click(await screen.findByRole("button", { name: "Remove beach.png" }));
    expect(screen.queryByTestId("pending-attachments")).not.toBeInTheDocument();
  });

  it("clears the queue after sending", async () => {
    const user = userEvent.setup();
    render(<Composer onSend={vi.fn()} onTyping={vi.fn()} />);

    await user.upload(screen.getByLabelText("Choose files to attach"), png());
    await screen.findByTestId("pending-attachments");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.queryByTestId("pending-attachments")).not.toBeInTheDocument();
  });
});

describe("the reply preview", () => {
  const quote: Quote = {
    id: 3,
    sender_id: 1,
    body: "Where are we going?",
    sender_name: "Alice Chen",
    attachment_count: 0,
  };

  it("shows who is being answered and what they said", () => {
    render(<Composer onSend={vi.fn()} onTyping={vi.fn()} replyTo={quote} meId={2} />);
    const preview = screen.getByTestId("reply-preview");
    expect(preview).toHaveTextContent("Alice Chen");
    expect(preview).toHaveTextContent("Where are we going?");
  });

  it("says You when answering yourself", () => {
    render(<Composer onSend={vi.fn()} onTyping={vi.fn()} replyTo={quote} meId={1} />);
    expect(screen.getByTestId("reply-preview")).toHaveTextContent("You");
  });

  it("is absent when not replying", () => {
    render(<Composer onSend={vi.fn()} onTyping={vi.fn()} />);
    expect(screen.queryByTestId("reply-preview")).not.toBeInTheDocument();
  });

  it("can be cancelled", async () => {
    const user = userEvent.setup();
    const onCancelReply = vi.fn();
    render(
      <Composer onSend={vi.fn()} onTyping={vi.fn()} replyTo={quote} onCancelReply={onCancelReply} />
    );
    await user.click(screen.getByRole("button", { name: "Cancel reply" }));
    expect(onCancelReply).toHaveBeenCalled();
  });
});
