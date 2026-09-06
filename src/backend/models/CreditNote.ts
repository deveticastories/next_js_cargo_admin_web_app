import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** One petty-cash fund entry; balance carries forward automatically. Mirrors `CreditNoteEntry` in src/types. */
const creditNoteSchema = new Schema(
  {
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
  },
  baseSchemaOptions
);
withCode(creditNoteSchema, "CN");

export const CreditNote = models.CreditNote ?? model("CreditNote", creditNoteSchema);
