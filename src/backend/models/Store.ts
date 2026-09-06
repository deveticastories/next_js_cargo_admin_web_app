import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A Kochi or UAE warehouse location. Mirrors `Store` in src/types. */
const storeSchema = new Schema(
  {
    location: { type: String, required: true, unique: true, trim: true },
    contact: { type: String, required: true, trim: true },
    inCharge: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(storeSchema, "STR");

export const Store = models.Store ?? model("Store", storeSchema);
