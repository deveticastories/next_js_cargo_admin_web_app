import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";

/**
 * One booking that has arrived at the UAE store after stuffing. Mirrors
 * `UaeStoreLogEntry` in src/types. Read-only from the API's point of view —
 * entries are only ever created as a side effect of `POST /api/stuffings`.
 */
const uaeStoreLogSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    receiver: { type: String, required: true },
    bundles: { type: Number, required: true },
    stuffing: { type: Schema.Types.ObjectId, ref: "Stuffing", required: true },
    date: { type: Date, default: Date.now },
  },
  baseSchemaOptions
);

export const UaeStoreLog = models.UaeStoreLog ?? model("UaeStoreLog", uaeStoreLogSchema);
