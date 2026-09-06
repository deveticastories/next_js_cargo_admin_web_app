import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A third-party partner who collects bundles from senders. Mirrors `PickupPartner` in src/types. */
const pickupPartnerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(pickupPartnerSchema, "PCK");

export const PickupPartner = models.PickupPartner ?? model("PickupPartner", pickupPartnerSchema);
