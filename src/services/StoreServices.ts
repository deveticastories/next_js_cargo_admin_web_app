/** UAE stores — cargo-backend's `/stores` module. No natural human code, so one is synthesized for display. */
import type { Store } from "@/types";
import { createCrudService, fallbackCode, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc): Store {
  return {
    id: doc._id,
    code: fallbackCode("STR", doc._id),
    location: String(doc.location ?? ""),
    contact: String(doc.contact ?? ""),
    inCharge: String(doc.inCharge ?? ""),
    status: statusToStr(doc.status),
  };
}

function toBackend(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    location: body.location,
    contact: body.contact,
    inCharge: body.inCharge,
  };
  const status = statusToBool(body.status);
  if (status !== undefined) payload.status = status;
  return payload;
}

export const StoreServices: EntityService<Store> = createCrudService<Store>({
  basePath: API_ENDPOINTS.STORES.BASE,
  listKey: "stores",
  itemKey: "store",
  toFrontend,
  toBackend,
});
