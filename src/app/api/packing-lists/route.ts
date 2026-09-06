import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/backend/config/db";
import { PackingList } from "@/backend/models/PackingList";
import { requireAuth } from "@/backend/utils/auth";
import { HttpError, readJsonBody, withErrorHandling } from "@/backend/utils/apiResponse";

/**
 * A packing list is looked up by booking + bundle number, not by its own
 * id, and "saving" one always means "create it if it doesn't exist yet,
 * otherwise overwrite its items" (see `BundleWorkspace` on the frontend) —
 * so this resource gets a hand-written upsert instead of the generic
 * create/update pair.
 */

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);
  await connectDB();
  const bookingId = req.nextUrl.searchParams.get("bookingId");
  const filter = bookingId ? { booking: bookingId } : {};
  const lists = await PackingList.find(filter).sort({ bundleNumber: 1 });
  return NextResponse.json(lists);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);
  await connectDB();
  const body = await readJsonBody<{ bookingId?: string; bundleNumber?: number; items?: unknown[] }>(req);
  if (!body.bookingId || !body.bundleNumber) {
    throw new HttpError("bookingId and bundleNumber are required.", 400);
  }
  const list = await PackingList.findOneAndUpdate(
    { booking: body.bookingId, bundleNumber: body.bundleNumber },
    { items: body.items ?? [] },
    { new: true, upsert: true, runValidators: true }
  );
  return NextResponse.json(list);
});
