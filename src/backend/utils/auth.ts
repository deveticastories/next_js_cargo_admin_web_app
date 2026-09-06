import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken, type AccessTokenPayload } from "@/backend/utils/tokens";
import { HttpError } from "@/backend/utils/apiResponse";

/**
 * Every data route (the generic CRUD controller and the hand-written
 * `/api/stuffings`, `/api/packing-lists`, `/api/uae-store-log` routes)
 * calls this first. `proxy.ts` also keeps signed-out visitors away from the
 * `/admin` pages, but that's just a fast, optimistic UI redirect — this is
 * the actual authorization check, done at the data layer as recommended by
 * the Next.js authentication guide.
 */
export async function requireAuth(req: NextRequest): Promise<AccessTokenPayload> {
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new HttpError("Not authenticated.", 401);
  try {
    return await verifyAccessToken(token);
  } catch {
    throw new HttpError("Not authenticated.", 401);
  }
}
