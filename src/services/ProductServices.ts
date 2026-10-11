/** Product names picked in packing lists — cargo-backend's `/products` module. */
import type { Product } from "@/types";
import { createCrudService, fallbackCode, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc): Product {
  return {
    id: doc._id,
    code: fallbackCode("PRD", doc._id),
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

export const ProductServices: EntityService<Product> = createCrudService<Product>({
  basePath: API_ENDPOINTS.PRODUCTS.BASE,
  listKey: "products",
  itemKey: "product",
  toFrontend,
  toBackend,
});
