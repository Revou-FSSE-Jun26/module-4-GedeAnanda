import { NextResponse, type NextRequest } from "next/server";

import { TOKEN_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/register"]);

/**
 * Sends visitors without a session cookie to /login (REQ-4.1). This is only a
 * first gate: the API checks the token itself on every request.
 */
export function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname) || request.cookies.has(TOKEN_COOKIE)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except Next's own assets and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)"],
};
