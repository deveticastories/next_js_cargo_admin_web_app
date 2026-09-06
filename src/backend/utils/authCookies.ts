import type { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from "@/backend/utils/tokens";

// `secure` requires HTTPS, which local dev doesn't use — only require it in production.
const isProd = process.env.NODE_ENV === "production";

const baseCookie = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

export function setAccessCookie(res: NextResponse, token: string): void {
  res.cookies.set(ACCESS_TOKEN_COOKIE, token, { ...baseCookie, maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS });
}

export function setRefreshCookie(res: NextResponse, token: string): void {
  res.cookies.set(REFRESH_TOKEN_COOKIE, token, { ...baseCookie, maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS });
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.delete(ACCESS_TOKEN_COOKIE);
  res.cookies.delete(REFRESH_TOKEN_COOKIE);
}
