import { NextResponse, type NextRequest } from "next/server";
import { setAccessCookie } from "@/backend/utils/authCookies";
import { REFRESH_TOKEN_COOKIE } from "@/backend/utils/tokens";
import { mintAccessTokenFromRefresh } from "@/backend/utils/refreshSession";
import { HttpError, withErrorHandling } from "@/backend/utils/apiResponse";

/**
 * Mints a fresh (short-lived) access token from the refresh cookie, without
 * requiring the password again. Called automatically by the frontend's API
 * client (`src/utils/apiClient.ts`) whenever a request comes back 401.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) throw new HttpError("Not authenticated.", 401);

  const accessToken = await mintAccessTokenFromRefresh(refreshToken);
  if (!accessToken) throw new HttpError("Session expired. Please log in again.", 401);

  const res = NextResponse.json({ success: true });
  setAccessCookie(res, accessToken);
  return res;
});
