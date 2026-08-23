import { describe, expect, it } from "vitest";

import { mobilePane, sectionFor, showsChatList, showsTabBar } from "./shell";

describe("sectionFor", () => {
  it("maps each route to a section", () => {
    expect(sectionFor("/")).toBe("chats");
    expect(sectionFor("/chat")).toBe("chat");
    expect(sectionFor("/chat?c=3")).toBe("chat");
    expect(sectionFor("/calls")).toBe("calls");
    expect(sectionFor("/stories")).toBe("stories");
    expect(sectionFor("/settings")).toBe("settings");
  });

  it("treats anything unknown as the chat list", () => {
    expect(sectionFor("/whatever")).toBe("chats");
  });
});

describe("mobilePane — only one pane fits on a phone", () => {
  it("shows the conversation list on the chats tab", () => {
    expect(mobilePane("/")).toBe("list");
  });

  it("shows the thread once a chat is open", () => {
    expect(mobilePane("/chat?c=3")).toBe("main");
  });

  it("shows the placeholder pages on their own", () => {
    expect(mobilePane("/calls")).toBe("main");
    expect(mobilePane("/stories")).toBe("main");
  });

  it("gives settings the whole screen", () => {
    expect(mobilePane("/settings")).toBe("main");
  });
});

describe("showsChatList", () => {
  it("shows beside the chats tab and an open thread", () => {
    expect(showsChatList("/")).toBe(true);
    expect(showsChatList("/chat?c=3")).toBe(true);
  });

  it("stays out of the sections that own the whole screen", () => {
    expect(showsChatList("/calls")).toBe(false);
    expect(showsChatList("/stories")).toBe(false);
    expect(showsChatList("/settings")).toBe(false);
  });
});

describe("showsTabBar", () => {
  it("shows on the top-level tabs", () => {
    expect(showsTabBar("/")).toBe(true);
    expect(showsTabBar("/calls")).toBe(true);
    expect(showsTabBar("/stories")).toBe(true);
  });

  it("hides inside a conversation, as Signal does", () => {
    expect(showsTabBar("/chat?c=3")).toBe(false);
  });

  it("hides in settings", () => {
    expect(showsTabBar("/settings")).toBe(false);
  });
});
