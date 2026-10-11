/**
 * cargo-backend has no API for Credit notes, Daily expenses, Invoicing,
 * Receipt entry or the UAE store log — Booking, Package (packing lists) and
 * Stuffing are now live (see `BookingServices.ts`, `PackageServices.ts`,
 * `StuffingServices.ts`); these remaining ones stay fully working but
 * entirely local: an in-memory, this-browser-tab-only store (no network,
 * nothing persisted across a reload) standing in until a real backend
 * module exists for them.
 *
 * Each service below is a module-level singleton — created once, not per
 * render — so data survives navigating between screens in the same session.
 */
import type { CreditNoteEntry, DailyExpense, Invoice, ReceiptEntry, UaeStoreLogEntry } from "@/types";
import type { EntityService } from "./entityHelpers";

let uid = 0;
function nextId(): string {
  uid += 1;
  return `local-${Date.now().toString(36)}-${uid.toString(36)}`;
}

export function createLocalCollectionService<T extends { id: string }>(codePrefix: string): EntityService<T> {
  let items: T[] = [];
  let seq = 0;

  return {
    async list() {
      return items;
    },
    async create(body) {
      seq += 1;
      const created = {
        ...(body as object),
        id: nextId(),
        code: `${codePrefix}-${String(seq).padStart(4, "0")}`,
      } as unknown as T;
      items = [created, ...items];
      return created;
    },
    async update(id, body) {
      let updated: T | undefined;
      items = items.map((item) => {
        if (item.id !== id) return item;
        updated = { ...item, ...(body as object) } as T;
        return updated;
      });
      if (!updated) throw new Error("Record not found.");
      return updated;
    },
    async remove(id) {
      items = items.filter((item) => item.id !== id);
    },
  };
}

export const UaeStoreLogLocalServices = createLocalCollectionService<UaeStoreLogEntry>("LOG");
export const DailyExpenseLocalServices = createLocalCollectionService<DailyExpense>("EXP");
export const InvoiceLocalServices = createLocalCollectionService<Invoice>("INV");
export const ReceiptEntryLocalServices = createLocalCollectionService<ReceiptEntry>("RCP");
export const CreditNoteLocalServices = createLocalCollectionService<CreditNoteEntry>("CRN");
