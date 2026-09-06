import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/backend/config/db";
import { Admin } from "@/backend/models/Admin";
import { setAccessCookie, setRefreshCookie } from "@/backend/utils/authCookies";
import { signAccessToken, signRefreshToken } from "@/backend/utils/tokens";
import { HttpError, readJsonBody, withErrorHandling } from "@/backend/utils/apiResponse";

export const POST = withErrorHandling(async (req: NextRequest) => {
  await connectDB();
  const { email, password } = await readJsonBody<{ email?: string; password?: string }>(req);
  if (!email || !password) {
    throw new HttpError("Email and password are required.", 400);
  }

  // Same message for "no such admin" and "wrong password" — never reveal which one it was.
  const invalid = () => new HttpError("Invalid email or password.", 401);

  const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash");
  if (!admin) throw invalid();

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
  if (!passwordMatches) throw invalid();

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: admin.id, email: admin.email, role: admin.role }),
    signRefreshToken({ sub: admin.id, v: admin.tokenVersion }),
  ]);

  const res = NextResponse.json({ email: admin.email, role: admin.role });
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
  return res;
});
