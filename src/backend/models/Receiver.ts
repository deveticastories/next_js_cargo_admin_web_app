import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A person who collects a shipment at the destination. Mirrors `Receiver` in src/types. */
const receiverSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, unique: true, trim: true },
    country: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    discount: { type: String, default: "0" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(receiverSchema, "RCV");

export const Receiver = models.Receiver ?? model("Receiver", receiverSchema);
