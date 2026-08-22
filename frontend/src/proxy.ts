import { NextResponse, type NextRequest } from "next/server";

const LOGIN = "/login";

/**
 * Cheap route guard, running at the network boundary in front of the app.
 * (Next 16 renamed this file convention from `middleware` to `proxy`.)
 *
 * The presence of the session cookie decides which half of the app you may
 * see. The cookie is httpOnly and signed, so the real authorisation still
 * happens on every API call — this only avoids flashing the app shell at
 * someone who is not signed in.
 */
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has("session");
  const { pathname } = request.nextUrl;

  if (!signedIn && pathname !== LOGIN) {
    return NextResponse.redirect(new URL(LOGIN, request.url));
  }
  if (signedIn && pathname === LOGIN) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Leave alone: the API rewrites, Next internals, and anything with a file
  // extension. Without the dot rule, /icon.svg was redirected to /login and
  // signed-out visitors got no favicon.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.).*)"],
};
