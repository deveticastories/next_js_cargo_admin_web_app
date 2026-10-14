/**
 * Petty cash fund entries — cargo-backend's `/credit-notes` module. Every
 * write makes the backend recompute its petty cash balance (sum of credit
 * notes, less daily expenses); the screen derives the same figures from the
 * two lists it already has.
 */
import type { CreditNoteEntry } from "@/types";
import { http } from "./httpClient";
import { createCrudService, fallbackCode, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc): CreditNoteEntry {
  return {
    id: doc._id,
    code: fallbackCode("CRN", doc._id),
    date: String(doc.createdAt ?? ""),
    amount: Number(doc.amount ?? 0),
    description: doc.description ? String(doc.description) : "",
  };
}

function toBackend(body: Record<string, unknown>) {
  return {
    amount: body.amount !== undefined && body.amount !== "" ? Number(body.amount) : undefined,
    description: body.description ?? undefined,
  };
}

const crud = createCrudService<CreditNoteEntry>({
  basePath: API_ENDPOINTS.CREDIT_NOTES.BASE,
  listKey: "creditNotes",
  itemKey: "creditNote",
  toFrontend,
  toBackend,
});

export const CreditNoteServices: EntityService<CreditNoteEntry> = {
  ...crud,
  // GET-all nests the list one level deeper than the other modules:
  // `{ creditNotes: { creditNoteList, pettyCashBalance, balanceAfterExpenses } }`.
  async list() {
    const res = await http.get<{ creditNotes?: { creditNoteList?: BackendDoc[] } }>(API_ENDPOINTS.CREDIT_NOTES.BASE);
    return (res.creditNotes?.creditNoteList ?? []).map(toFrontend);
  },
};
