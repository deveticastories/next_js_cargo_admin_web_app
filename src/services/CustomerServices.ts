/**
 * Senders and receivers are two screens in the frontend but one Mongoose
 * model in cargo-backend — `Customer`, distinguished by `customerType`
 * ("Sender" | "Receiver"). Both services below hit the same `/customers`
 * endpoint and filter/tag by that field, so neither screen has to change.
 */
import type { Receiver, Sender } from "@/types";
import { http } from "./httpClient";
import { LOOKUP_MAX_AGE_MS, fallbackCode, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

type CustomerType = "Sender" | "Receiver";

async function listCustomers(maxAgeMs = 0): Promise<BackendDoc[]> {
  const res = await http.get<{ customers?: BackendDoc[] }>(API_ENDPOINTS.CUSTOMERS.BASE, { maxAgeMs });
  return res.customers ?? [];
}

function senderFromDoc(doc: BackendDoc): Sender {
  return {
    id: doc._id,
    code: fallbackCode("SND", doc._id),
    name: String(doc.name ?? ""),
    whatsapp: String(doc.whatsapp ?? ""),
    location: String(doc.location ?? ""),
    status: statusToStr(doc.status),
  };
}

function receiverFromDoc(doc: BackendDoc): Receiver {
  return {
    id: doc._id,
    code: fallbackCode("RCV", doc._id),
    name: String(doc.name ?? ""),
    whatsapp: String(doc.whatsapp ?? ""),
    alternativeNo: doc.alternativeNo ? String(doc.alternativeNo) : undefined,
    country: String(doc.country ?? ""),
    location: String(doc.location ?? ""),
    discount: doc.discount !== undefined ? String(doc.discount) : undefined,
    status: statusToStr(doc.status),
  };
}

function toBackendCommon(body: Record<string, unknown>, customerType: CustomerType) {
  const payload: Record<string, unknown> = {
    customerType,
    name: body.name,
    whatsapp: body.whatsapp,
    location: body.location,
  };
  if (customerType === "Receiver") {
    payload.alternativeNo = body.alternativeNo || undefined;
    payload.country = body.country;
    payload.discount = body.discount !== undefined && body.discount !== "" ? Number(body.discount) : undefined;
  }
  const status = statusToBool(body.status);
  if (status !== undefined) payload.status = status;
  return payload;
}

function makeCustomerService<T extends { id: string }>(
  customerType: CustomerType,
  toFrontend: (doc: BackendDoc) => T
): EntityService<T> {
  return {
    async list() {
      const docs = await listCustomers();
      return docs.filter((d) => d.customerType === customerType).map(toFrontend);
    },
    async create(body) {
      const res = await http.post<{ customer: BackendDoc }>(API_ENDPOINTS.CUSTOMERS.BASE, toBackendCommon(body, customerType));
      return toFrontend(res.customer);
    },
    async update(id, body) {
      const res = await http.put<{ customer: BackendDoc }>(API_ENDPOINTS.CUSTOMERS.BY_ID(id), toBackendCommon(body, customerType));
      return toFrontend(res.customer);
    },
    async remove(id) {
      await http.delete(API_ENDPOINTS.CUSTOMERS.BY_ID(id));
    },
  };
}

export const SenderServices: EntityService<Sender> = makeCustomerService("Sender", senderFromDoc);
export const ReceiverServices: EntityService<Receiver> = makeCustomerService("Receiver", receiverFromDoc);

/** Resolves a sender/receiver's display name to its Customer id — for forms (Booking, Pre-booking) that still pick by name. */
export async function resolveCustomerIdByName(name: string, customerType: CustomerType): Promise<string | undefined> {
  if (!name) return undefined;
  const find = async (maxAgeMs: number) =>
    (await listCustomers(maxAgeMs)).find((d) => d.customerType === customerType && d.name === name)?._id;
  // Reuse the list the screen just loaded; only refetch if the name isn't in it.
  return (await find(LOOKUP_MAX_AGE_MS)) ?? (await find(0));
}
