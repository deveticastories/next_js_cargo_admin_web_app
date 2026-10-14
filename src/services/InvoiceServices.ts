/**
 * Booking invoices — cargo-backend's `/invoices` module. Only create + list +
 * get-by-id exist server-side (no update/delete route). The client sends just
 * the container, booking and delivery partner ids; the backend computes every
 * amount from the booking and assigns the sequential invoice number itself.
 */
import type { Invoice } from "@/types";
import { createCrudService, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function refId(ref: unknown): string {
  if (ref && typeof ref === "object" && "_id" in ref) return String((ref as { _id: unknown })._id);
  return String(ref ?? "");
}

function refField(ref: unknown, field: string): unknown {
  return ref && typeof ref === "object" ? (ref as Record<string, unknown>)[field] : undefined;
}

function toFrontend(doc: BackendDoc): Invoice {
  const charge = refField(doc.deliveryPartner, "charge");
  return {
    id: doc._id,
    code: String(doc.invoiceNo ?? doc._id),
    bookingId: refId(doc.booking),
    bookingCode: String(refField(doc.booking, "bookingId") ?? ""),
    containerId: refId(doc.container),
    container: refField(doc.container, "containerCode") as string | undefined,
    deliveryPartnerId: refId(doc.deliveryPartner),
    deliveryPartner: refField(doc.deliveryPartner, "name") as string | undefined,
    deliveryCharge: charge !== undefined ? Number(charge) : undefined,
    subtotal: Number(doc.subtotal ?? 0),
    additionalCharges: Number(doc.additionalCharges ?? 0),
    receivableDiscount: Number(doc.receivableDiscount ?? 0),
    amount: Number(doc.total ?? 0),
    createdAt: doc.createdAt ? String(doc.createdAt) : undefined,
  };
}

function toBackend(body: Record<string, unknown>) {
  return {
    container: body.containerId,
    booking: body.bookingId,
    deliveryPartner: body.deliveryPartnerId,
  };
}

const notSupported = () => {
  throw new Error("Invoices can't be edited or deleted once generated.");
};

export const InvoiceServices: EntityService<Invoice> = {
  ...createCrudService<Invoice>({
    basePath: API_ENDPOINTS.INVOICES.BASE,
    listKey: "invoiceList",
    itemKey: "data",
    toFrontend,
    toBackend,
  }),
  update: notSupported,
  remove: notSupported,
};
