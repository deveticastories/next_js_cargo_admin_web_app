/** Day-to-day operational spends — cargo-backend's `/daily-expenses` module. No Active/Inactive status. */
import type { DailyExpense } from "@/types";
import { createCrudService, fallbackCode, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc): DailyExpense {
  return {
    id: doc._id,
    code: fallbackCode("EXP", doc._id),
    date: String(doc.date ?? ""),
    type: String(doc.expenseType ?? ""),
    paymentType: (doc.paymentType as DailyExpense["paymentType"]) ?? "",
    amount: Number(doc.amount ?? 0),
    description: doc.description ? String(doc.description) : "",
  };
}

function toBackend(body: Record<string, unknown>) {
  return {
    date: body.date || undefined,
    expenseType: body.type || undefined,
    paymentType: body.paymentType || undefined,
    amount: body.amount !== undefined && body.amount !== "" ? Number(body.amount) : undefined,
    description: body.description ?? undefined,
  };
}

export const DailyExpenseServices: EntityService<DailyExpense> = createCrudService<DailyExpense>({
  basePath: API_ENDPOINTS.DAILY_EXPENSES.BASE,
  // Both the list and the single-record envelopes use `data`.
  listKey: "data",
  itemKey: "data",
  toFrontend,
  toBackend,
});
