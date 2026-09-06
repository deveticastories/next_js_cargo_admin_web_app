import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A container moving between Kochi and the UAE. Mirrors `Container` in src/types. */
const containerSchema = new Schema(
  {
    company: { type: String, required: true, trim: true },
    stuffingDate: { type: Date, required: true },
    cutOffDate: { type: Date },
    etaCok: { type: Date },
    etdCok: { type: Date },
    etaUae: { type: Date },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(containerSchema, "CNT");

export const Container = models.Container ?? model("Container", containerSchema);
