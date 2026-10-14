/**
 * Payments received against invoices — cargo-backend's `/receipt-entries`
 * module. `invoice` is an Invoice ref (populated on reads); `balanceAmount`
 * is always recomputed server-side as receivable − received. The delivery
 * partner's payment status also has its own PATCH endpoint, exported below.
 */
import type { DeliveryPartnerStatus, ReceiptEntry } from "@/types";
import { http } from "./httpClient";
import { createCrudService, fallbackCode, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc, submitted?: Record<string, unknown>): ReceiptEntry {
  const invoice = doc.invoice && typeof doc.invoice === "object" ? (doc.invoice as Record<string, unknown>) : undefined;
  return {
    id: doc._id,
    code: fallbackCode("RCP", doc._id),
    date: String(doc.date ?? ""),
    invoiceId: invoice ? String(invoice._id) : String(doc.invoice ?? ""),
    invoiceNo: String(invoice?.invoiceNo ?? submitted?.invoiceNo ?? ""),
    receivableAmount: Number(doc.receivableAmount ?? 0),
    receivedAmount: Number(doc.receivedAmount ?? 0),
    balanceAmount: Number(doc.balanceAmount ?? 0),
    receivedDate: String(doc.receivedDate ?? ""),
    deliveryPartnerAmount: Number(doc.deliveryPartnerAmount ?? 0),
    deliveryPartnerStatus: doc.deliveryPartnerStatus === "Paid" ? "Paid" : "Pending",
  };
}

const num = (v: unknown) => (v !== undefined && v !== "" ? Number(v) : undefined);

function toBackend(body: Record<string, unknown>) {
  return {
    invoice: body.invoiceId || undefined,
    date: body.date || undefined,
    receivableAmount: num(body.receivableAmount),
    receivedAmount: num(body.receivedAmount),
    receivedDate: body.receivedDate || undefined,
    deliveryPartnerAmount: num(body.deliveryPartnerAmount),
    deliveryPartnerStatus: body.deliveryPartnerStatus || undefined,
  };
}

export const ReceiptEntryServices: EntityService<ReceiptEntry> = createCrudService<ReceiptEntry>({
  basePath: API_ENDPOINTS.RECEIPT_ENTRIES.BASE,
  listKey: "receiptEntryList",
  itemKey: "receiptEntry",
  toFrontend,
  toBackend,
});

/** `PATCH /receipt-entries/:id/delivery-partner-status` — marks the delivery partner's share paid/pending. */
export async function updateDeliveryPartnerStatus(id: string, deliveryPartnerStatus: DeliveryPartnerStatus): Promise<void> {
  await http.patch(API_ENDPOINTS.RECEIPT_ENTRIES.DELIVERY_PARTNER_STATUS(id), { deliveryPartnerStatus });
}
