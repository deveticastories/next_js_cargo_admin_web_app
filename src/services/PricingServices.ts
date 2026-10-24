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

/** Spellings of the invoice route's two ends — cargo-backend's invoice lookup accepts the same ones, in any casing. */
const CANONICAL_PLACES: Record<string, string> = {
  india: "India",
  uae: "UAE",
  "u.a.e": "UAE",
  "u.a.e.": "UAE",
  "united arab emirates": "UAE",
  dubai: "UAE",
};

/** Maps a route end to "India" / "UAE" when it's a known spelling of either; otherwise returns it trimmed. */
export function canonicalPlace(value: unknown): string {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return CANONICAL_PLACES[text.toLowerCase()] ?? text;
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
