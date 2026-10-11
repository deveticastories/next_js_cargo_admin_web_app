/** Fabric names picked in packing lists — cargo-backend's `/fabrics` module. */
import type { Fabric } from "@/types";
import { createCrudService, fallbackCode, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc): Fabric {
  return {
    id: doc._id,
    code: fallbackCode("FAB", doc._id),
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

export const FabricServices: EntityService<Fabric> = createCrudService<Fabric>({
  basePath: API_ENDPOINTS.FABRICS.BASE,
  listKey: "fabrics",
  itemKey: "fabric",
  toFrontend,
  toBackend,
});
