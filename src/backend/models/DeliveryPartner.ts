import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A last-mile delivery vendor at the receiving end. Mirrors `DeliveryPartner` in src/types. */
const deliveryPartnerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, unique: true, trim: true },
    from: { type: String, trim: true },
    toCountry: { type: String, trim: true },
    charge: { type: String, default: "0" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(deliveryPartnerSchema, "DLV");

export const DeliveryPartner = models.DeliveryPartner ?? model("DeliveryPartner", deliveryPartnerSchema);
