import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@/backend/utils/tokens";
import { HttpError, withErrorHandling } from "@/backend/utils/apiResponse";

/** Tells the frontend who's currently logged in, from the access token alone (no DB hit). */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new HttpError("Not authenticated.", 401);

  try {
    const { email, role } = await verifyAccessToken(token);
    return NextResponse.json({ email, role });
  } catch {
    throw new HttpError("Not authenticated.", 401);
  }
});
