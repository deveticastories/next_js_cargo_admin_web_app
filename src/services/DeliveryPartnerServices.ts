/**
 * Last-mile delivery vendors — cargo-backend's `/delivery-partners` module.
 * `from`/`toCountry` are Country references there; the frontend picks them
 * by name (see `DeliveryPartnersScreen`), so this resolves name -> id on
 * write. cargo-backend populates both on every read, so no lookup is needed
 * the other way.
 */
import type { DeliveryPartner } from "@/types";
import { createCrudService, resolveIdByName, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function countryName(ref: unknown): string | undefined {
  if (ref && typeof ref === "object" && "name" in ref) return String((ref as { name?: unknown }).name ?? "");
  return undefined;
}

function toFrontend(doc: BackendDoc, submitted?: Record<string, unknown>): DeliveryPartner {
  return {
    id: doc._id,
    code: `DLP-${doc._id.slice(-6).toUpperCase()}`,
    name: String(doc.name ?? ""),
    whatsapp: String(doc.whatsapp ?? ""),
    from: countryName(doc.from) ?? (submitted?.from as string | undefined) ?? "",
    toCountry: countryName(doc.toCountry) ?? (submitted?.toCountry as string | undefined) ?? "",
    charge: doc.charge !== undefined ? String(doc.charge) : "0",
    status: statusToStr(doc.status),
  };
}

async function toBackend(body: Record<string, unknown>) {
  const [fromId, toId] = await Promise.all([
    body.from ? resolveIdByName(API_ENDPOINTS.COUNTRIES.BASE, "countries", String(body.from)) : Promise.resolve(undefined),
    body.toCountry ? resolveIdByName(API_ENDPOINTS.COUNTRIES.BASE, "countries", String(body.toCountry)) : Promise.resolve(undefined),
  ]);
  const payload: Record<string, unknown> = {
    name: body.name,
    whatsapp: body.whatsapp,
    from: fromId,
    toCountry: toId,
    charge: body.charge !== undefined && body.charge !== "" ? Number(body.charge) : undefined,
  };
  const status = statusToBool(body.status);
  if (status !== undefined) payload.status = status;
  return payload;
}

export const DeliveryPartnerServices: EntityService<DeliveryPartner> = createCrudService<DeliveryPartner>({
  basePath: API_ENDPOINTS.DELIVERY_PARTNERS.BASE,
  listKey: "deliveryPartners",
  itemKey: "deliveryPartner",
  toFrontend,
  toBackend,
});
