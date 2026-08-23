import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MessageBubble } from "./MessageBubble";
import type { Attachment, Message, Quote, Reaction, UserBrief } from "@/lib/types";

const bob: UserBrief = {
  id: 2,
  display_name: "Bob Martinez",
  phone: "+15550000002",
  avatar_url: null,
  avatar_color: "#336BA3",
  avatar_fg: "#5C5C5C",
  about: null,
  last_seen_at: null,
  online: false,
};

const message = (over: Partial<Message> = {}): Message => ({
  id: 7,
  conversation_id: 1,
  sender_id: 2,
  type: "text",
  body: "I vote coast",
  created_at: "2026-08-23T10:00:00Z",
  sender: bob,
  ...over,
});

const png: Attachment = {
  id: 1,
  name: "beach.png",
  mime: "image/png",
  size: 2048,
  data_url: "data:image/png;base64,AAA",
  width: 800,
  height: 600,
  is_image: true,
};
const pdf: Attachment = { ...png, id: 2, name: "notes.pdf", mime: "application/pdf", is_image: false };

const props = {
  outgoing: false,
  groupStart: true,
  groupEnd: true,
  showSender: false,
};

describe("attachments", () => {
  it("renders an image inline", () => {
    render(<MessageBubble {...props} message={message({ attachments: [png] })} />);
    expect(screen.getByRole("img", { name: "beach.png" })).toBeInTheDocument();
  });

  it("offers a file as a download chip rather than inline", () => {
    render(<MessageBubble {...props} message={message({ body: "", attachments: [pdf] })} />);
    const link = screen.getByRole("link", { name: /notes\.pdf/ });
    expect(link).toHaveAttribute("download", "notes.pdf");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("labels the chip with its size", () => {
    render(<MessageBubble {...props} message={message({ body: "", attachments: [pdf] })} />);
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("draws no empty paragraph for a caption-less image", () => {
    render(<MessageBubble {...props} message={message({ body: "", attachments: [png] })} />);
    expect(screen.queryByTestId("bubble-body")).not.toBeInTheDocument();
  });

  it("keeps the caption when there is one", () => {
    render(<MessageBubble {...props} message={message({ body: "look", attachments: [png] })} />);
    expect(screen.getByTestId("bubble-body")).toHaveTextContent("look");
  });

  it("hides attachments on a deleted message", () => {
    render(
      <MessageBubble
        {...props}
        message={message({ attachments: [png], deleted_at: "2026-08-23T11:00:00Z" })}
      />
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("bubble-body")).toHaveTextContent("This message was deleted");
  });
});

describe("quoted replies", () => {
  const quote: Quote = {
    id: 3,
    sender_id: 1,
    body: "Where are we going?",
    sender_name: "Alice Chen",
    attachment_count: 0,
  };

  it("shows the quoted snippet above the reply", () => {
    render(<MessageBubble {...props} message={message({ quote })} />);
    expect(screen.getByTestId("bubble-quote")).toHaveTextContent("Where are we going?");
    expect(screen.getByTestId("bubble-quote")).toHaveTextContent("Alice Chen");
  });

  it("says Photo when the quoted message was an image with no caption", () => {
    render(
      <MessageBubble {...props} message={message({ quote: { ...quote, body: "", attachment_count: 1 } })} />
    );
    expect(screen.getByTestId("bubble-quote")).toHaveTextContent("Photo");
  });

  it("marks a quote of a deleted message rather than showing its text", () => {
    render(
      <MessageBubble
        {...props}
        message={message({ quote: { ...quote, deleted_at: "2026-08-23T11:00:00Z" } })}
      />
    );
    expect(screen.getByTestId("bubble-quote")).toHaveTextContent("This message was deleted");
    expect(screen.getByTestId("bubble-quote")).not.toHaveTextContent("Where are we going");
  });

  it("hands the caller a quote of itself when Reply is used", async () => {
    const user = userEvent.setup();
    const onReply = vi.fn();
    render(<MessageBubble {...props} message={message()} onReply={onReply} />);

    await user.click(screen.getByRole("button", { name: "Reply" }));
    expect(onReply).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, body: "I vote coast", sender_name: "Bob Martinez" })
    );
  });

  it("offers no actions on a deleted message", () => {
    render(
      <MessageBubble
        {...props}
        message={message({ deleted_at: "2026-08-23T11:00:00Z" })}
        onReply={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });
});

describe("reactions", () => {
  const thumbs: Reaction = { emoji: "👍", count: 2, names: ["Alice Chen", "Bob Martinez"], mine: true };

  it("shows a pill with its count", () => {
    render(<MessageBubble {...props} message={message({ reactions: [thumbs] })} onReact={vi.fn()} />);
    expect(screen.getByRole("button", { name: /👍 2/ })).toBeInTheDocument();
  });

  it("omits the visible count on a lone reaction", () => {
    render(
      <MessageBubble
        {...props}
        message={message({ reactions: [{ ...thumbs, count: 1, names: ["Alice Chen"] }] })}
        onReact={vi.fn()}
      />
    );
    // A "1" beside a single emoji is noise, but the label still carries it so
    // a screen reader hears the count.
    const pill = screen.getByRole("button", { name: /👍 1/ });
    expect(pill.textContent).toBe("👍");
  });

  it("marks a pill I am in as pressed", () => {
    render(<MessageBubble {...props} message={message({ reactions: [thumbs] })} onReact={vi.fn()} />);
    expect(screen.getByRole("button", { name: /👍/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("names who reacted, for a tooltip", () => {
    render(<MessageBubble {...props} message={message({ reactions: [thumbs] })} onReact={vi.fn()} />);
    expect(screen.getByRole("button", { name: /👍/ })).toHaveAttribute(
      "title",
      "Alice Chen, Bob Martinez reacted 👍"
    );
  });

  it("toggles when a pill is clicked", async () => {
    const user = userEvent.setup();
    const onReact = vi.fn();
    render(<MessageBubble {...props} message={message({ reactions: [thumbs] })} onReact={onReact} />);

    await user.click(screen.getByRole("button", { name: /👍/ }));
    expect(onReact).toHaveBeenCalledWith(7, "👍");
  });

  it("opens the tray from the react button and reports the pick", async () => {
    const user = userEvent.setup();
    const onReact = vi.fn();
    render(<MessageBubble {...props} message={message()} onReact={onReact} />);

    await user.click(screen.getByRole("button", { name: "React" }));
    await user.click(screen.getByRole("menuitem", { name: "React ❤️" }));
    expect(onReact).toHaveBeenCalledWith(7, "❤️");
  });

  it("closes the tray after a pick", async () => {
    const user = userEvent.setup();
    render(<MessageBubble {...props} message={message()} onReact={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "React" }));
    await user.click(screen.getByRole("menuitem", { name: "React 👍" }));
    expect(screen.queryByRole("menu", { name: "React" })).not.toBeInTheDocument();
  });
});

describe("disappearing messages", () => {
  it("shows how long is left", () => {
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    render(<MessageBubble {...props} message={message({ expires_at: expires })} />);
    expect(screen.getByTestId("bubble-expiry")).toHaveTextContent("5m");
  });

  it("counts down in seconds when the end is near", () => {
    const expires = new Date(Date.now() + 42 * 1000).toISOString();
    render(<MessageBubble {...props} message={message({ expires_at: expires })} />);
    expect(screen.getByTestId("bubble-expiry")).toHaveTextContent("42s");
  });

  it("shows nothing on a message that stays", () => {
    render(<MessageBubble {...props} message={message()} />);
    expect(screen.queryByTestId("bubble-expiry")).not.toBeInTheDocument();
  });

  it("never counts below zero", () => {
    const expires = new Date(Date.now() - 60 * 1000).toISOString();
    render(<MessageBubble {...props} message={message({ expires_at: expires })} />);
    expect(screen.getByTestId("bubble-expiry")).toHaveTextContent("0s");
  });
});
