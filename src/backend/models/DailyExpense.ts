import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** A day-to-day operational spend. Mirrors `DailyExpense` in src/types. No active/inactive status. */
const dailyExpenseSchema = new Schema(
  {
    date: { type: Date, required: true },
    type: { type: String, required: true, trim: true },
    paymentType: { type: String, enum: ["Cash", "UPI"], required: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
  },
  baseSchemaOptions
);
withCode(dailyExpenseSchema, "EXP");

export const DailyExpense = models.DailyExpense ?? model("DailyExpense", dailyExpenseSchema);
