/**
 * "Load these bookings into this container" events — cargo-backend's
 * `/stuffings` module. Only create + list + get-by-id exist server-side (no
 * update/delete route), which is fine: `StuffingScreen` only ever reads
 * `stuffings.items`/`.loading`/`.refetch()`, never `.update()`/`.remove()`.
 */
import type { Stuffing } from "@/types";
import { createCrudService, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function refId(ref: unknown): string {
  if (ref && typeof ref === "object" && "_id" in ref) return String((ref as { _id: unknown })._id);
  return String(ref ?? "");
}

function toFrontend(doc: BackendDoc): Stuffing {
  return {
    id: doc._id,
    code: String(doc._id).slice(-6).toUpperCase(),
    container: refId(doc.container),
    bookings: Array.isArray(doc.bookings) ? (doc.bookings as unknown[]).map(refId) : [],
    date: String(doc.date ?? ""),
  };
}

function toBackend(body: Record<string, unknown>) {
  return {
    container: body.container,
    bookings: body.bookings,
  };
}

const notSupported = () => {
  throw new Error("Not supported by cargo-backend's stuffing module.");
};

export const StuffingServices: EntityService<Stuffing> = {
  ...createCrudService<Stuffing>({
    basePath: API_ENDPOINTS.STUFFINGS.BASE,
    listKey: "stuffingList",
    itemKey: "data",
    toFrontend,
    toBackend,
  }),
  update: notSupported,
  remove: notSupported,
};
