import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A product name picked in the Repacking / Package ready packing lists. Mirrors `Product` in src/types. */
const productSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(productSchema, "PRD");

export const Product = models.Product ?? model("Product", productSchema);
