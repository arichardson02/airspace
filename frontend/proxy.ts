import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// A quick redirect for visitors with no session cookie at all. It doesn't check the session;
// the pages do that with the backend (lib/session.ts).
export function proxy(request: NextRequest): NextResponse {
  const cookie = getSessionCookie(request);
  if (cookie !== null && cookie !== "") return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  login.searchParams.set("redirect", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/app/:path*", "/device"],
};
