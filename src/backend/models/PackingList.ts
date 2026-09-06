import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";

/** One row of a packing list. Mirrors `BundleLineItem` in src/types. */
const bundleLineItemSchema = new Schema(
  {
    netWeight: { type: String, default: "" },
    grossWeight: { type: String, default: "" },
    product: { type: String, default: "" },
    qty: { type: String, default: "" },
    fabric: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * The packing list for one bundle of one booking (Ready to ship / Repacking
 * screens). Replaces the frontend mockup's in-memory `bundleItems` map —
 * `booking` + `bundleNumber` together are what `${bookingId}#${bundle}` was
 * used as a key for there.
 */
const packingListSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    bundleNumber: { type: Number, required: true, min: 1 },
    items: { type: [bundleLineItemSchema], default: [] },
  },
  baseSchemaOptions
);
packingListSchema.index({ booking: 1, bundleNumber: 1 }, { unique: true });

export const PackingList = models.PackingList ?? model("PackingList", packingListSchema);
