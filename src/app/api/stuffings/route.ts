import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/backend/config/db";
import { Booking } from "@/backend/models/Booking";
import { Container } from "@/backend/models/Container";
import { Stuffing } from "@/backend/models/Stuffing";
import { UaeStoreLog } from "@/backend/models/UaeStoreLog";
import { requireAuth } from "@/backend/utils/auth";
import { HttpError, readJsonBody, withErrorHandling } from "@/backend/utils/apiResponse";

/**
 * Loading bookings into a container touches three collections at once — the
 * stuffing record itself, every chosen booking's `stuffed` flag, the
 * container's status (→ "Stuffed"), and the UAE store's incoming log (see `StuffingScreen` on the frontend) — so this
 * is a hand-written handler wrapped in a transaction, rather than the
 * generic controller.
 */

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);
  await connectDB();
  const stuffings = await Stuffing.find().sort({ createdAt: -1 });
  return NextResponse.json(stuffings);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);
  await connectDB();
  const { containerId, bookingIds } = await readJsonBody<{ containerId?: string; bookingIds?: string[] }>(req);
  if (!containerId || !bookingIds?.length) {
    throw new HttpError("containerId and at least one bookingId are required.", 400);
  }

  const container = await Container.findById(containerId);
  if (!container) {
    throw new HttpError("Container could not be found.", 404);
  }
  if (container.status === "Stuffed" || (await Stuffing.exists({ container: containerId }))) {
    throw new HttpError(`Container ${container.code} has already been stuffed.`, 409);
  }

  const bookings = await Booking.find({ _id: { $in: bookingIds } });
  if (bookings.length !== bookingIds.length) {
    throw new HttpError("One or more bookings could not be found.", 404);
  }
  const alreadyStuffed = bookings.find((b) => b.stuffed);
  if (alreadyStuffed) {
    throw new HttpError(`Booking ${alreadyStuffed.code} has already been stuffed.`, 409);
  }
  const notSent = bookings.find((b) => !b.sentToStuffing);
  if (notSent) {
    throw new HttpError(`Booking ${notSent.code} hasn't been sent from Ready to stuff yet.`, 409);
  }

  const session = await mongoose.startSession();
  let stuffing;
  try {
    await session.withTransaction(async () => {
      const [created] = await Stuffing.create([{ container: containerId, bookings: bookingIds }], { session });
      await Booking.updateMany({ _id: { $in: bookingIds } }, { $set: { stuffed: true } }, { session });
      await Container.updateOne({ _id: containerId }, { $set: { status: "Stuffed" } }, { session });
      await UaeStoreLog.insertMany(
        bookings.map((b) => ({ booking: b._id, receiver: b.receiver, bundles: b.bundleCount, stuffing: created._id })),
        { session }
      );
      stuffing = created;
    });
  } finally {
    await session.endSession();
  }

  return NextResponse.json(stuffing, { status: 201 });
});
