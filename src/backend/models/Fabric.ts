import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A fabric picked in the Repacking / Package ready packing lists. Mirrors `Fabric` in src/types. */
const fabricSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(fabricSchema, "FAB");

export const Fabric = models.Fabric ?? model("Fabric", fabricSchema);
