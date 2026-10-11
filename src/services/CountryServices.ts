/** Countries usable as delivery-partner route endpoints — cargo-backend's `/countries` module. */
import type { Country } from "@/types";
import { createCrudService, fallbackCode, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc): Country {
  return {
    id: doc._id,
    code: fallbackCode("CTY", doc._id),
    name: String(doc.name ?? ""),
    status: statusToStr(doc.status),
  };
}

function toBackend(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = { name: body.name };
  const status = statusToBool(body.status);
  if (status !== undefined) payload.status = status;
  return payload;
}

export const CountryServices: EntityService<Country> = createCrudService<Country>({
  basePath: API_ENDPOINTS.COUNTRIES.BASE,
  listKey: "countries",
  itemKey: "country",
  toFrontend,
  toBackend,
});
