import { Schema, deleteModel, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A last-mile delivery vendor at the receiving end. Mirrors `DeliveryPartner` in src/types. */
const deliveryPartnerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, trim: true },
    from: { type: String, trim: true, default: "" },
    toCountry: { type: String, trim: true, default: "" },
    charge: { type: String, default: "0" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(deliveryPartnerSchema, "DLV");
// The same WhatsApp number may serve several routes — only the same number on the same
// From → To route counts as a duplicate.
deliveryPartnerSchema.index({ whatsapp: 1, from: 1, toCountry: 1 }, { unique: true });

// A model cached (e.g. across dev hot reloads) from the old schema — `whatsapp` unique on its
// own — would keep enforcing that rule, so rebuild it from the current schema.
if (models.DeliveryPartner && !models.DeliveryPartner.schema.indexes().some(([fields]) => "toCountry" in fields)) {
  deleteModel("DeliveryPartner");
}

export const DeliveryPartner = models.DeliveryPartner ?? model("DeliveryPartner", deliveryPartnerSchema);

const globalForIndexes = globalThis as typeof globalThis & { _deliveryPartnerRouteIndexReady?: Promise<void> };

/**
 * Drops the old unique index on `whatsapp` alone (Mongoose never removes an index on its own
 * once it's gone from the schema) and builds the route-scoped one above. Runs once per server
 * process; call it after `connectDB()` and before writing a delivery partner.
 */
export function ensureDeliveryPartnerIndexes(): Promise<void> {
  globalForIndexes._deliveryPartnerRouteIndexReady ??= (async () => {
    const collection = DeliveryPartner.collection;
    if (await collection.indexExists("whatsapp_1")) await collection.dropIndex("whatsapp_1");
    await collection.createIndex({ whatsapp: 1, from: 1, toCountry: 1 }, { unique: true });
  })().catch((err: unknown) => {
    // Let the next request retry instead of caching the failure.
    globalForIndexes._deliveryPartnerRouteIndexReady = undefined;
    throw err;
  });
  return globalForIndexes._deliveryPartnerRouteIndexReady;
}
