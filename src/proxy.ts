import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, verifyAccessToken } from "@/backend/utils/tokens";
import { setAccessCookie } from "@/backend/utils/authCookies";
import { mintAccessTokenFromRefresh } from "@/backend/utils/refreshSession";

/**
 * Optimistic auth gate for the admin panel. Runs before every `/admin` or
 * `/login` request and checks the access token's signature/expiry (no
 * database call). Only when the access token is missing/expired but a
 * refresh cookie is present does it hit the database to mint a new access
 * token — otherwise reloading any `/admin` page more than 15 minutes after
 * the last API call would bounce a still-signed-in user to `/login`.
 * The actual authorization check happens again at the data layer
 * (`requireAuth`, called by every API route).
 *
 * Note: this file is named `proxy.ts`, not `middleware.ts` — Next.js 16
 * renamed the convention (same behavior, new name/export). Proxy runs on
 * the Node.js runtime, so it can use Mongoose.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  let isAuthenticated = token ? await isValidAccessToken(token) : false;

  let renewedAccessToken: string | null = null;
  if (!isAuthenticated) {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (refreshToken) {
      renewedAccessToken = await mintAccessTokenFromRefresh(refreshToken).catch(() => null);
      isAuthenticated = renewedAccessToken !== null;
    }
  }

  let res: NextResponse;
  if (pathname.startsWith("/admin") && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    res = NextResponse.redirect(loginUrl);
  } else if (pathname === "/login" && isAuthenticated) {
    res = NextResponse.redirect(new URL("/admin", request.url));
  } else {
    res = NextResponse.next();
  }

  if (renewedAccessToken) setAccessCookie(res, renewedAccessToken);
  return res;
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
