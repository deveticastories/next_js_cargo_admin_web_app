import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "@/services/httpClient";

/**
 * Optimistic auth gate for the admin panel. Runs before every `/admin` or
 * `/login` request and checks the Bearer token's expiry — decoded only, not
 * verified, since the signing secret lives on cargo-backend and nowhere in
 * this app. There's nothing to renew: cargo-backend's JWT is a single 1-day
 * token with no refresh endpoint, so a session that's expired just goes
 * back to `/login`. The actual authorization check happens again at the
 * data layer — cargo-backend's own `verifyToken` middleware rejects an
 * invalid/expired token regardless of what this gate decided.
 *
 * Note: this file is named `proxy.ts`, not `middleware.ts` — Next.js 16
 * renamed the convention (same behavior, new name/export).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const isAuthenticated = isValidToken(token);

  if (pathname.startsWith("/admin") && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    // A token that's present but no longer valid means the session ran out, not that they never signed in.
    if (token) loginUrl.searchParams.set("reason", "expired");
    return NextResponse.redirect(loginUrl);
  }
  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.next();
}

function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return Boolean(payload.exp) && payload.exp! * 1000 > Date.now();
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
