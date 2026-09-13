import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/**
 * A shipment booked in ahead of the full workflow — same shape as `Booking`
 * except the receiver isn't known yet, so there's no `receiver` field; a
 * `phoneNumber` is captured instead so the sender can be reached. Mirrors
 * `PreBooking` in src/types.
 */
const preBookingSchema = new Schema(
  {
    sender: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    pickupOption: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    billOption: { type: String, enum: ["With Bill", "Without Bill"], required: true },
    bundleCount: { type: Number, required: true, min: 1 },
    bundleType: { type: String, enum: ["Bundle", "Box", "CBM", "KG"], required: true },
    productType: { type: String, enum: ["Branded", "Normal"], required: true },
    repackingStatus: { type: String, enum: ["Ready to Ship", "Repacking Required"], default: "Repacking Required" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    stuffed: { type: Boolean, default: false },
    // Conditional extra charges from the pre-booking form — each only applies
    // under its own condition (see the matching comment on `PreBooking` in
    // src/types); the form itself zeroes out whichever ones don't apply
    // before saving, so a stored non-zero value always means "this
    // pre-booking's condition held at save time."
    brandHandlingCharge: { type: Number, default: 0, min: 0 },
    pickupCharge: { type: Number, default: 0, min: 0 },
    bundleHandlingCharge: { type: Number, default: 0, min: 0 },
    // Set by the Repacking screen's "Confirm" action (how many bundles were
    // actually created), not by the pre-booking form — see `PreBooking` in src/types.
    actualBundle: { type: Number, default: 0, min: 0 },
  },
  baseSchemaOptions
);
withCode(preBookingSchema, "PBK");

export const PreBooking = models.PreBooking ?? model("PreBooking", preBookingSchema);
