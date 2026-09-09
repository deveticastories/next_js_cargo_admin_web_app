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
    bundleType: { type: String, enum: ["Bundle", "Box", "CBM", "KG"], required: true },
    productType: { type: String, enum: ["Branded", "Normal"], required: true },
    repackingStatus: { type: String, enum: ["Ready to Ship", "Repacking Required"], default: "Repacking Required" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    stuffed: { type: Boolean, default: false },
    // Conditional extra charges from the booking form — each only applies
    // under its own condition (see the matching comment on `Booking` in
    // src/types); the form itself zeroes out whichever ones don't apply
    // before saving, so a stored non-zero value always means "this
    // booking's condition held at save time."
    brandHandlingCharge: { type: Number, default: 0, min: 0 },
    pickupCharge: { type: Number, default: 0, min: 0 },
    bundleHandlingCharge: { type: Number, default: 0, min: 0 },
  },
  baseSchemaOptions
);
withCode(bookingSchema, "BKG");

export const Booking = models.Booking ?? model("Booking", bookingSchema);
