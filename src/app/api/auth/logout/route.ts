import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/backend/config/db";
import { Admin } from "@/backend/models/Admin";
import { Employee } from "@/backend/models/Employee";
import { clearAuthCookies } from "@/backend/utils/authCookies";
import { REFRESH_TOKEN_COOKIE, verifyRefreshToken } from "@/backend/utils/tokens";
import { withErrorHandling } from "@/backend/utils/apiResponse";

/** Clears both cookies and bumps `tokenVersion` so the refresh token can't be reused. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await connectDB();
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    try {
      const { sub, kind } = await verifyRefreshToken(refreshToken);
      const Model = kind === "employee" ? Employee : Admin;
      await Model.findByIdAndUpdate(sub, { $inc: { tokenVersion: 1 } });
    } catch {
      // Already invalid/expired — nothing left to revoke.
    }
  }

  const res = NextResponse.json({ success: true });
  clearAuthCookies(res);
  return res;
});
