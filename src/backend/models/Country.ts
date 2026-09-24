import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A country usable as a delivery partner's From/To route endpoint. Mirrors `Country` in src/types. */
const countrySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(countrySchema, "CTY");

export const Country = models.Country ?? model("Country", countrySchema);
