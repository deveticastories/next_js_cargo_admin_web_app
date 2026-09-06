import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/backend/config/db";
import { Admin } from "@/backend/models/Admin";
import { setAccessCookie } from "@/backend/utils/authCookies";
import { REFRESH_TOKEN_COOKIE, signAccessToken, verifyRefreshToken } from "@/backend/utils/tokens";
import { HttpError, withErrorHandling } from "@/backend/utils/apiResponse";

/**
 * Mints a fresh (short-lived) access token from the refresh cookie, without
 * requiring the password again. Called automatically by the frontend's API
 * client (`src/utils/apiClient.ts`) whenever a request comes back 401.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await connectDB();
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) throw new HttpError("Not authenticated.", 401);

  const expired = () => new HttpError("Session expired. Please log in again.", 401);

  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    throw expired();
  }

  const admin = await Admin.findById(payload.sub);
  // `tokenVersion` mismatch means this refresh token was invalidated by a logout.
  if (!admin || admin.tokenVersion !== payload.v) throw expired();

  const accessToken = await signAccessToken({ sub: admin.id, email: admin.email, role: admin.role });
  const res = NextResponse.json({ success: true });
  setAccessCookie(res, accessToken);
  return res;
});
