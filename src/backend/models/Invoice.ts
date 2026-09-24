import mongoose, { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** An invoice generated from the Invoicing screen — one per booking, refreshed when regenerated. Mirrors `Invoice` in src/types. */
const invoiceSchema = new Schema(
  {
    bookingCode: { type: String, required: true, trim: true, unique: true },
    sender: { type: String, trim: true },
    receiver: { type: String, trim: true },
    /** Code of the stuffed container picked on the Invoicing screen. */
    container: { type: String, trim: true, default: "" },
    /** Final invoice total, including any pickup and delivery charge. */
    amount: { type: Number, required: true, min: 0 },
    /** Delivery partner picked when the invoice was generated, and what they're owed. */
    deliveryPartner: { type: String, trim: true, default: "" },
    deliveryCharge: { type: Number, min: 0, default: 0 },
    /** Whether that delivery partner amount has been settled — changed from the Receipt Entry table. */
    deliveryPaymentStatus: { type: String, enum: ["Paid", "Pending"], default: "Pending" },
  },
  baseSchemaOptions
);
withCode(invoiceSchema, "INV");

// In dev, hot reload keeps a model compiled from the old schema alive — drop it and re-register.
if (models.Invoice && (!models.Invoice.schema.path("deliveryPaymentStatus") || !models.Invoice.schema.path("container"))) {
  mongoose.deleteModel("Invoice");
}

export const Invoice = models.Invoice ?? model("Invoice", invoiceSchema);
