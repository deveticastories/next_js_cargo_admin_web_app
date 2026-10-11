/** Transport vendors used by Pickup assign — cargo-backend's `/pickup-partners` module. */
import type { PickupPartner } from "@/types";
import { createCrudService, fallbackCode, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc): PickupPartner {
  return {
    id: doc._id,
    code: fallbackCode("PUP", doc._id),
    name: String(doc.name ?? ""),
    whatsapp: String(doc.whatsapp ?? ""),
    status: statusToStr(doc.status),
  };
}

function toBackend(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = { name: body.name, whatsapp: body.whatsapp };
  const status = statusToBool(body.status);
  if (status !== undefined) payload.status = status;
  return payload;
}

export const PickupPartnerServices: EntityService<PickupPartner> = createCrudService<PickupPartner>({
  basePath: API_ENDPOINTS.PICKUP_PARTNERS.BASE,
  listKey: "pickupPartners",
  itemKey: "pickupPartner",
  toFrontend,
  toBackend,
});
