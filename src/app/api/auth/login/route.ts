import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/backend/config/db";
import { Admin } from "@/backend/models/Admin";
import { Employee } from "@/backend/models/Employee";
import { setAccessCookie, setRefreshCookie } from "@/backend/utils/authCookies";
import { signAccessToken, signRefreshToken, type AccountKind } from "@/backend/utils/tokens";
import { HttpError, readJsonBody, withErrorHandling } from "@/backend/utils/apiResponse";

/**
 * Two kinds of account can sign in: the seeded super admin (`Admin`), or a
 * Team member (`Employee`) with login credentials set on their record (see
 * `TeamScreen`). Same message either way for "no such account", "no
 * password set" and "wrong password" — never reveal which one it was.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await connectDB();
  const { email, password } = await readJsonBody<{ email?: string; password?: string }>(req);
  if (!email || !password) {
    throw new HttpError("Email and password are required.", 400);
  }

  const invalid = () => new HttpError("Invalid email or password.", 401);
  const normalizedEmail = email.toLowerCase().trim();

  const admin = await Admin.findOne({ email: normalizedEmail }).select("+passwordHash");
  // A deactivated employee can't sign in even with the right password.
  const employee = admin
    ? null
    : await Employee.findOne({ email: normalizedEmail, status: "Active" }).select("+passwordHash");
  const account = admin ?? employee;
  if (!account || !account.passwordHash) throw invalid();

  const passwordMatches = await bcrypt.compare(password, account.passwordHash);
  if (!passwordMatches) throw invalid();

  const kind: AccountKind = admin ? "admin" : "employee";
  const role: string = admin ? admin.role : employee!.role;
  const tokenVersion: number = account.tokenVersion ?? 0;

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: account.id, email: account.email, role, kind }),
    signRefreshToken({ sub: account.id, v: tokenVersion, kind }),
  ]);

  const res = NextResponse.json({ email: account.email, role });
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
  return res;
});
