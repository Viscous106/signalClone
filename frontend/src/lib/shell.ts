/**
 * Which parts of the shell a route shows.
 *
 * The desktop layout is three panes side by side. A phone only has room for
 * one, so each route names the pane it owns and the rest is hidden by CSS.
 */

export type Section = "chats" | "chat" | "calls" | "stories" | "settings";

export function sectionFor(pathname: string): Section {
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/calls")) return "calls";
  if (pathname.startsWith("/stories")) return "stories";
  if (pathname.startsWith("/settings")) return "settings";
  return "chats";
}

/** The single pane a phone should show for this route. */
export function mobilePane(pathname: string): "list" | "main" {
  return sectionFor(pathname) === "chats" ? "list" : "main";
}

/**
 * The chat list belongs to the chats section alone.
 *
 * Calls, Stories and Settings each own the whole content area — carrying the
 * list into them would leave a pane that has nothing to do with the page.
 */
export function showsChatList(pathname: string): boolean {
  const section = sectionFor(pathname);
  return section === "chats" || section === "chat";
}

/** Signal hides the bottom tabs inside a conversation and in settings. */
export function showsTabBar(pathname: string): boolean {
  const section = sectionFor(pathname);
  return section !== "chat" && section !== "settings";
}
