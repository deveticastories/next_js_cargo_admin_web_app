import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A person or business who books shipments. Mirrors `Sender` in src/types. */
const senderSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, unique: true, trim: true },
    location: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(senderSchema, "SND");

export const Sender = models.Sender ?? model("Sender", senderSchema);
