import mongoose, { Schema, model, models } from "mongoose";
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
    /** Who repacked this bundle — recorded by the Repacking screen's Confirm; left untouched by Ready to ship saves. */
    repackedBy: { type: String, default: "", trim: true },
  },
  baseSchemaOptions
);
packingListSchema.index({ booking: 1, bundleNumber: 1 }, { unique: true });

// In dev, hot reload keeps the first-registered model alive — one compiled before `repackedBy`
// existed would silently strip that field on every save, so drop a stale copy and re-register.
if (models.PackingList && !models.PackingList.schema.path("repackedBy")) {
  mongoose.deleteModel("PackingList");
}

export const PackingList = models.PackingList ?? model("PackingList", packingListSchema);
