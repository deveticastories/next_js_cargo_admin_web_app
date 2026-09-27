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

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/** The next unused bundle mark ID — one past the highest handed out so far. */
async function nextBundleMarkId(): Promise<number> {
  const last = await PackingList.findOne({ bundleMarkId: { $exists: true } })
    .sort({ bundleMarkId: -1 })
    .select("bundleMarkId")
    .lean<{ bundleMarkId: number }>();
  return (last?.bundleMarkId ?? 0) + 1;
}

/**
 * Gives the packing list with this id a bundle mark ID if it doesn't have one yet. Two saves
 * racing for the same number hit the unique index — the loser just retries with the next one.
 */
async function ensureBundleMarkId(id: unknown): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await PackingList.updateOne({ _id: id, bundleMarkId: { $exists: false } }, { bundleMarkId: await nextBundleMarkId() });
      return;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
    }
  }
  throw new HttpError("Couldn't assign a bundle mark ID — please try again.", 409);
}

/** Lists saved before bundle mark IDs existed get one, oldest first, the next time lists are read. */
async function backfillBundleMarkIds(): Promise<void> {
  const missing = await PackingList.find({ bundleMarkId: { $exists: false } })
    .sort({ createdAt: 1, _id: 1 })
    .select("_id")
    .lean<{ _id: unknown }[]>();
  for (const list of missing) await ensureBundleMarkId(list._id);
}

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);
  await connectDB();
  await backfillBundleMarkIds();
  const bookingId = req.nextUrl.searchParams.get("bookingId");
  const filter = bookingId ? { booking: bookingId } : {};
  const lists = await PackingList.find(filter).sort({ bundleNumber: 1 });
  return NextResponse.json(lists);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);
  await connectDB();
  const body = await readJsonBody<{ bookingId?: string; bundleNumber?: number; items?: unknown[]; repackedBy?: string; readySaved?: boolean }>(req);
  if (!body.bookingId || !body.bundleNumber) {
    throw new HttpError("bookingId and bundleNumber are required.", 400);
  }
  const list = await PackingList.findOneAndUpdate(
    { booking: body.bookingId, bundleNumber: body.bundleNumber },
    { items: body.items ?? [], ...(typeof body.repackedBy === "string" ? { repackedBy: body.repackedBy } : {}), ...(body.readySaved === true ? { readySaved: true } : {}) },
    { new: true, upsert: true, runValidators: true }
  );
  // A bundle keeps the mark ID from its first save — re-saving it (or saving it again from the
  // other screen) doesn't hand out a new number.
  if (list.bundleMarkId) return NextResponse.json(list);
  await ensureBundleMarkId(list._id);
  return NextResponse.json(await PackingList.findById(list._id));
});
