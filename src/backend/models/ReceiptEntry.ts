import mongoose, { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** Money received against an invoice. Mirrors `ReceiptEntry` in src/types. No active/inactive status. */
const receiptEntrySchema = new Schema(
  {
    date: { type: Date, required: true },
    invoiceNo: { type: String, required: true, trim: true },
    invoiceAmount: { type: Number, required: true, min: 0 },
    receivedAmount: { type: Number, required: true, min: 0 },
  },
  baseSchemaOptions
);
withCode(receiptEntrySchema, "RCP");

// In dev, hot reload keeps the first-registered model alive — drop a copy compiled from the old schema.
if (models.ReceiptEntry && !models.ReceiptEntry.schema.path("invoiceNo")) {
  mongoose.deleteModel("ReceiptEntry");
}

export const ReceiptEntry = models.ReceiptEntry ?? model("ReceiptEntry", receiptEntrySchema);
