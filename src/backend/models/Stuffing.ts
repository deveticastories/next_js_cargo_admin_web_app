import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** One "load these bookings into this container" event. Mirrors `Stuffing` in src/types. */
const stuffingSchema = new Schema(
  {
    container: { type: Schema.Types.ObjectId, ref: "Container", required: true },
    bookings: { type: [{ type: Schema.Types.ObjectId, ref: "Booking" }], required: true, validate: (v: unknown[]) => v.length > 0 },
    date: { type: Date, default: Date.now },
  },
  baseSchemaOptions
);
withCode(stuffingSchema, "STF");

export const Stuffing = models.Stuffing ?? model("Stuffing", stuffingSchema);
