/** Route-wise price per unit of measure — cargo-backend's `/pricing` module. No Active/Inactive status. */
import type { PricingRoute } from "@/types";
import { http } from "./httpClient";
import { fallbackCode, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc): PricingRoute {
  return {
    id: doc._id,
    code: fallbackCode("PRC", doc._id),
    from: String(doc.from ?? ""),
    to: String(doc.to ?? ""),
    uom: String(doc.uom ?? ""),
    price: doc.price !== undefined ? String(doc.price) : "0",
  };
}

function toBackend(body: Record<string, unknown>) {
  return {
    from: body.from,
    to: body.to,
    uom: body.uom,
    price: body.price !== undefined && body.price !== "" ? Number(body.price) : undefined,
  };
}

export const PricingServices: EntityService<PricingRoute> = {
  async list() {
    const res = await http.get<{ pricings?: BackendDoc[] }>(API_ENDPOINTS.PRICING.BASE);
    return (res.pricings ?? []).map(toFrontend);
  },
  async create(body) {
    const res = await http.post<{ pricing: BackendDoc }>(API_ENDPOINTS.PRICING.BASE, toBackend(body));
    return toFrontend(res.pricing);
  },
  async update(id, body) {
    const res = await http.put<{ pricing: BackendDoc }>(API_ENDPOINTS.PRICING.BY_ID(id), toBackend(body));
    return toFrontend(res.pricing);
  },
  async remove(id) {
    await http.delete(API_ENDPOINTS.PRICING.BY_ID(id));
  },
};
