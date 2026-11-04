/** Units of measure picked on packing-list product lines — cargo-backend's `/units` module. */
import type { Unit } from "@/types";
import { createCrudService, fallbackCode, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

// Unlike most masters, Unit keeps its status as an "Active" | "Inactive" string under `unitStatus`, not a boolean `status`.
function toFrontend(doc: BackendDoc): Unit {
  return {
    id: doc._id,
    code: fallbackCode("UNT", doc._id),
    name: String(doc.name ?? ""),
    status: doc.unitStatus === "Inactive" ? "Inactive" : "Active",
  };
}

function toBackend(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  if (body.name !== undefined) payload.name = body.name;
  if (body.status === "Active" || body.status === "Inactive") payload.unitStatus = body.status;
  return payload;
}

export const UnitServices: EntityService<Unit> = createCrudService<Unit>({
  basePath: API_ENDPOINTS.UNITS.BASE,
  listKey: "units",
  itemKey: "unit",
  toFrontend,
  toBackend,
});
