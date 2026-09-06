import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/**
 * One shipment booking — the entry point of the cargo workflow. Mirrors
 * `Booking` in src/types. `sender`/`receiver`/`pickupOption` are stored as
 * plain names (not references) to match how the admin panel's forms pick
 * them today.
 */
const bookingSchema = new Schema(
  {
    sender: { type: String, required: true, trim: true },
    receiver: { type: String, required: true, trim: true },
    pickupOption: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    billOption: { type: String, enum: ["With Bill", "Without Bill"], required: true },
    bundleCount: { type: Number, required: true, min: 1 },
    repackingStatus: { type: String, enum: ["Ready to Ship", "Repacking Required"], default: "Repacking Required" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    stuffed: { type: Boolean, default: false },
  },
  baseSchemaOptions
);
withCode(bookingSchema, "BKG");

export const Booking = models.Booking ?? model("Booking", bookingSchema);
