/**
 * Access roles an Employee is assigned — cargo-backend's `/roles` module.
 * Unlike the other masters, its GET-all is paginated (`{ data, pagination }`,
 * 10 per page by default, 100 max), so the list asks for the max in one go.
 */
import type { Role } from "@/types";
import { http } from "./httpClient";
import { createCrudService, fallbackCode, resolveIdByName, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

const LIST_PATH = `${API_ENDPOINTS.ROLES.BASE}?limit=100`;
const LIST_KEY = "data";

function toFrontend(doc: BackendDoc): Role {
  return {
    id: doc._id,
    code: fallbackCode("ROL", doc._id),
    name: String(doc.roleName ?? ""),
    modules: Array.isArray(doc.modules) ? doc.modules.map(String) : [],
    status: statusToStr(doc.status),
  };
}

function toBackend(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = { roleName: body.name, modules: body.modules };
  const status = statusToBool(body.status);
  if (status !== undefined) payload.status = status;
  return payload;
}

const crud = createCrudService<Role>({
  basePath: API_ENDPOINTS.ROLES.BASE,
  listKey: LIST_KEY,
  itemKey: "role",
  toFrontend,
  toBackend,
});

export const RoleServices: EntityService<Role> = {
  ...crud,
  async list() {
    const res = await http.get<Record<string, unknown>>(LIST_PATH);
    const arr = (res[LIST_KEY] as BackendDoc[] | undefined) ?? [];
    return arr.map((doc) => toFrontend(doc));
  },
};

/** Role name (as shown in the Team form) → its Mongo id, which is what `/employees` stores. */
export function resolveRoleIdByName(name: string): Promise<string | undefined> {
  return resolveIdByName(LIST_PATH, LIST_KEY, name, "roleName");
}
