import { describe, expect, it } from "vitest";

import { SHORTCUTS, displayKeys, firesWhileTyping, isTyping, match } from "./shortcuts";

const press = (init: Partial<KeyboardEventInit> & { key: string }) =>
  new KeyboardEvent("keydown", init);

describe("match", () => {
  it("maps the modifier combinations", () => {
    expect(match(press({ key: "k", ctrlKey: true }))).toBe("search");
    expect(match(press({ key: "n", ctrlKey: true }))).toBe("new-chat");
    expect(match(press({ key: ",", ctrlKey: true }))).toBe("settings");
    expect(match(press({ key: "/", ctrlKey: true }))).toBe("help");
  });

  it("accepts Cmd as well as Ctrl, for a Mac", () => {
    expect(match(press({ key: "k", metaKey: true }))).toBe("search");
  });

  it("takes Ctrl+? as help too, since ? needs shift on many layouts", () => {
    expect(match(press({ key: "?", ctrlKey: true }))).toBe("help");
  });

  it("switches theme on Ctrl+Shift+D", () => {
    expect(match(press({ key: "D", ctrlKey: true, shiftKey: true }))).toBe("theme");
  });

  it("does not take Ctrl+D without shift", () => {
    expect(match(press({ key: "d", ctrlKey: true }))).toBeNull();
  });

  it("is case insensitive, so Caps Lock does not break it", () => {
    expect(match(press({ key: "K", ctrlKey: true }))).toBe("search");
  });

  it("walks conversations with Alt and the arrows", () => {
    expect(match(press({ key: "ArrowDown", altKey: true }))).toBe("next-chat");
    expect(match(press({ key: "ArrowUp", altKey: true }))).toBe("previous-chat");
  });

  it("leaves bare arrows to the message box and the scroller", () => {
    expect(match(press({ key: "ArrowDown" }))).toBeNull();
  });

  it("takes Escape with no modifier", () => {
    expect(match(press({ key: "Escape" }))).toBe("close");
  });

  it("ignores an unbound key", () => {
    expect(match(press({ key: "j", ctrlKey: true }))).toBeNull();
    expect(match(press({ key: "a" }))).toBeNull();
  });
});

describe("isTyping", () => {
  it("is true inside the controls that own their keys", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isTyping(document.createElement(tag))).toBe(true);
    }
  });

  it("is true in a contenteditable", () => {
    const node = document.createElement("div");
    node.contentEditable = "true";
    // jsdom does not derive isContentEditable from the attribute.
    Object.defineProperty(node, "isContentEditable", { value: true });
    expect(isTyping(node)).toBe(true);
  });

  it("is false elsewhere", () => {
    expect(isTyping(document.createElement("div"))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe("firesWhileTyping", () => {
  it("lets Escape and the arrows through mid-sentence", () => {
    expect(firesWhileTyping("close")).toBe(true);
    expect(firesWhileTyping("next-chat")).toBe(true);
  });

  it("does not steal Ctrl+N from a half-written message", () => {
    expect(firesWhileTyping("new-chat")).toBe(false);
    expect(firesWhileTyping("search")).toBe(false);
  });

  it("treats an unknown id as not firing", () => {
    expect(firesWhileTyping("nonsense")).toBe(false);
  });
});

describe("displayKeys", () => {
  it("writes Ctrl on a PC", () => {
    expect(displayKeys("Ctrl+K", false)).toBe("Ctrl+K");
  });

  it("writes the Mac glyphs on a Mac", () => {
    expect(displayKeys("Ctrl+K", true)).toBe("⌘+K");
    expect(displayKeys("Alt+↓", true)).toBe("⌥+↓");
  });
});

describe("the sheet and the handler cannot drift", () => {
  it("lists each shortcut once — a duplicate id means a row nothing fires", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("binds every row in the sheet to a real key press", () => {
    // A row whose keys no press produces is a promise the app cannot keep.
    const bound = new Set(
      [
        press({ key: "k", ctrlKey: true }),
        press({ key: "n", ctrlKey: true }),
        press({ key: ",", ctrlKey: true }),
        press({ key: "/", ctrlKey: true }),
        press({ key: "Escape" }),
        press({ key: "ArrowDown", altKey: true }),
        press({ key: "ArrowUp", altKey: true }),
        press({ key: "D", ctrlKey: true, shiftKey: true }),
      ].map(match)
    );
    for (const shortcut of SHORTCUTS) {
      expect(bound.has(shortcut.id)).toBe(true);
    }
  });

  it("documents every shortcut match() can return", () => {
    const documented = new Set(SHORTCUTS.map((s) => s.id));
    const returned = [
      match(press({ key: "k", ctrlKey: true })),
      match(press({ key: "n", ctrlKey: true })),
      match(press({ key: ",", ctrlKey: true })),
      match(press({ key: "/", ctrlKey: true })),
      match(press({ key: "D", ctrlKey: true, shiftKey: true })),
      match(press({ key: "Escape" })),
      match(press({ key: "ArrowDown", altKey: true })),
      match(press({ key: "ArrowUp", altKey: true })),
    ];
    for (const id of returned) {
      expect(documented.has(id as string)).toBe(true);
    }
    expect(returned.filter(Boolean).length).toBe(SHORTCUTS.length);
  });
});
