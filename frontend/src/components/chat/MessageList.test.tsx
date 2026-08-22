import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageList } from "./MessageList";
import type { Message } from "@/lib/types";

const ME = 1;
let seq = 0;

const at = (
  hour: number,
  minute: number,
  senderId: number | null,
  body: string,
  extra: Partial<Message> = {}
): Message => ({
  id: ++seq,
  conversation_id: 1,
  sender_id: senderId,
  type: "text",
  body,
  created_at: new Date(2026, 7, 22, hour, minute).toISOString(),
  ...extra,
});

describe("MessageList", () => {
  it("renders every message in order", () => {
    render(
      <MessageList
        messages={[at(10, 0, 2, "first"), at(10, 1, ME, "second"), at(10, 2, 2, "third")]}
        meId={ME}
        isGroup={false}
      />
    );
    const bodies = screen.getAllByTestId("bubble-body").map((n) => n.textContent);
    expect(bodies).toEqual(["first", "second", "third"]);
  });

  it("shows a date divider", () => {
    render(<MessageList messages={[at(10, 0, 2, "hi")]} meId={ME} isGroup={false} />);
    expect(screen.getByTestId("date-divider")).toBeInTheDocument();
  });

  it("puts ticks on my messages only", () => {
    render(
      <MessageList
        messages={[at(10, 0, 2, "theirs"), at(10, 5, ME, "mine", { status: "read" })]}
        meId={ME}
        isGroup={false}
      />
    );
    expect(screen.getAllByLabelText(/read/i)).toHaveLength(1);
  });

  it("timestamps only the last bubble of a run", () => {
    render(
      <MessageList
        messages={[at(10, 0, 2, "one"), at(10, 1, 2, "two"), at(10, 2, 2, "three")]}
        meId={ME}
        isGroup={false}
      />
    );
    expect(screen.getAllByTestId("bubble-time")).toHaveLength(1);
  });

  it("names the sender in a group, once per run", () => {
    const withSender = (m: Message, name: string): Message => ({
      ...m,
      sender: {
        id: m.sender_id!,
        display_name: name,
        phone: "+15550000002",
        avatar_url: null,
        avatar_color: "#336BA3",
        about: null,
        last_seen_at: null,
        online: false,
      },
    });
    render(
      <MessageList
        messages={[
          withSender(at(10, 0, 2, "one"), "Bob Martinez"),
          withSender(at(10, 1, 2, "two"), "Bob Martinez"),
        ]}
        meId={ME}
        isGroup
      />
    );
    expect(screen.getAllByTestId("bubble-sender")).toHaveLength(1);
    expect(screen.getByTestId("bubble-sender")).toHaveTextContent("Bob Martinez");
  });

  it("does not name senders in a one-to-one chat", () => {
    render(<MessageList messages={[at(10, 0, 2, "hi")]} meId={ME} isGroup={false} />);
    expect(screen.queryByTestId("bubble-sender")).not.toBeInTheDocument();
  });

  it("renders a system notice without a bubble", () => {
    render(
      <MessageList
        messages={[at(10, 0, null, "Alice added Bob", { type: "system" })]}
        meId={ME}
        isGroup
      />
    );
    expect(screen.getByTestId("system-notice")).toHaveTextContent("Alice added Bob");
  });

  it("says so when there is nothing yet", () => {
    render(<MessageList messages={[]} meId={ME} isGroup={false} />);
    expect(screen.getByText(/no messages/i)).toBeInTheDocument();
  });
});
