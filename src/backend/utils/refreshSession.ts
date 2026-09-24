import { connectDB } from "@/backend/config/db";
import { Admin } from "@/backend/models/Admin";
import { Employee } from "@/backend/models/Employee";
import { signAccessToken, verifyRefreshToken } from "@/backend/utils/tokens";

/**
 * Mints a fresh access token from a refresh token, or returns `null` if the
 * refresh token is invalid, expired, revoked (`tokenVersion` mismatch — a
 * logout or password change) or belongs to a deactivated employee. Shared by
 * `/api/auth/refresh` and `src/proxy.ts`, so a page load after the 15-minute
 * access token lapses renews the session instead of bouncing to `/login`.
 */
export async function mintAccessTokenFromRefresh(refreshToken: string): Promise<string | null> {
  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    return null;
  }

  await connectDB();
  // Tokens signed before `kind` existed default to "admin" here — same as everywhere else it's read.
  const kind = payload.kind === "employee" ? "employee" : "admin";
  const account = kind === "employee" ? await Employee.findById(payload.sub) : await Admin.findById(payload.sub);

  if (!account || account.tokenVersion !== payload.v || (kind === "employee" && account.status !== "Active")) {
    return null;
  }

  return signAccessToken({ sub: account.id, email: account.email, role: account.role, kind });
}
