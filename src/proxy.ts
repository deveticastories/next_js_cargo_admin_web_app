import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@/backend/utils/tokens";

/**
 * Optimistic auth gate for the admin panel. Runs before every `/admin` or
 * `/login` request and only checks the access token's signature/expiry
 * (no database call — see the Next.js authentication guide's guidance on
 * keeping Proxy checks cheap). The actual authorization check happens
 * again at the data layer (`requireAuth`, called by every API route), so a
 * forged or replayed cookie still can't read or write real data.
 *
 * Note: this file is named `proxy.ts`, not `middleware.ts` — Next.js 16
 * renamed the convention (same behavior, new name/export).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const isAuthenticated = token ? await isValidAccessToken(token) : false;

  if (pathname.startsWith("/admin") && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

async function isValidAccessToken(token: string): Promise<boolean> {
  try {
    await verifyAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
