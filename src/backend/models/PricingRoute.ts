import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** Route-wise price per unit of measure. Mirrors `PricingRoute` in src/types. No active/inactive status. */
const pricingRouteSchema = new Schema(
  {
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    uom: { type: String, enum: ["Kg", "Bundle", "Box", "Pallet"], required: true },
    price: { type: String, required: true },
  },
  baseSchemaOptions
);
withCode(pricingRouteSchema, "PRC");
pricingRouteSchema.index({ from: 1, to: 1, uom: 1 }, { unique: true });

export const PricingRoute = models.PricingRoute ?? model("PricingRoute", pricingRouteSchema);
