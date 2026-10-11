/**
 * Shared plumbing for the per-entity service files in this folder. Every
 * cargo-backend CRUD module (see cargo-backend/src/modules/*) follows the
 * same two conventions these helpers bridge to the frontend's shape:
 *
 *  - Base status is a boolean (`status: true/false`) on every record;
 *    the frontend's generic `MasterView` toggles a string "Active"/"Inactive".
 *  - Most entities have no human-readable code field (unlike the old
 *    Next.js backend's `withCode`) — one is synthesized from the Mongo id
 *    for display only; it's never sent back to the server or used as a key.
 */
import { http } from "./httpClient";
import type { Status } from "@/types";

export interface EntityService<T> {
  list(): Promise<T[]>;
  create(body: Record<string, unknown>): Promise<T>;
  update(id: string, body: Record<string, unknown>) : Promise<T>;
  remove(id: string): Promise<void>;
}

export function statusToBool(status: unknown): boolean | undefined {
  if (status === "Active") return true;
  if (status === "Inactive") return false;
  return undefined;
}

export function statusToStr(status: unknown): Status {
  return status === false ? "Inactive" : "Active";
}

/** Short, stable, cosmetic id for entities with no natural human-readable code. Never sent to the server. */
export function fallbackCode(prefix: string, id: string): string {
  return `${prefix}-${id.slice(-6).toUpperCase()}`;
}

export interface BackendDoc {
  _id: string;
  status?: boolean;
  [key: string]: unknown;
}

interface CrudConfig<T extends { id: string }> {
  basePath: string;
  /** Key the GET-all envelope keeps the array under, e.g. "employees". */
  listKey: string;
  /** Key the create/update envelope keeps the single record under, e.g. "employee". */
  itemKey: string;
  toFrontend: (doc: BackendDoc, submitted?: Record<string, unknown>) => T;
  /** Maps the frontend form body to what the backend expects; may do async lookups (e.g. name -> id). */
  toBackend?: (body: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

/** Builds the uniform `{list,create,update,remove}` shape every service in this folder exposes. */
export function createCrudService<T extends { id: string }>(config: CrudConfig<T>): EntityService<T> {
  const toBackend = config.toBackend ?? ((body: Record<string, unknown>) => body);

  return {
    async list() {
      const res = await http.get<Record<string, unknown>>(config.basePath);
      const arr = (res[config.listKey] as BackendDoc[] | undefined) ?? [];
      return arr.map((doc) => config.toFrontend(doc));
    },
    async create(body) {
      const payload = await toBackend(body);
      const res = await http.post<Record<string, unknown>>(config.basePath, payload);
      return config.toFrontend(res[config.itemKey] as BackendDoc, body);
    },
    async update(id, body) {
      const payload = await toBackend(body);
      const res = await http.put<Record<string, unknown>>(`${config.basePath}/${id}`, payload);
      return config.toFrontend(res[config.itemKey] as BackendDoc, body);
    },
    async remove(id) {
      await http.delete(`${config.basePath}/${id}`);
    },
  };
}

/**
 * Some cargo-backend models require a unique human-readable code
 * (`containerCode`, `preBookingId`, ...) that their frontend form never
 * collects — the old Next.js backend generated these server-side
 * (`withCode`); cargo-backend doesn't, so one is synthesized here on create,
 * sequential within the existing records, e.g. "CTN-0001", "CTN-0002".
 */
export async function nextSequentialCode(
  basePath: string,
  listKey: string,
  field: string,
  prefix: string,
  pad = 4
): Promise<string> {
  const res = await http.get<Record<string, unknown>>(basePath);
  const arr = (res[listKey] as BackendDoc[] | undefined) ?? [];
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const doc of arr) {
    const match = String(doc[field] ?? "").match(re);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}

/** How old a cached list may be when resolving a name to an id on save. */
export const LOOKUP_MAX_AGE_MS = 60_000;

/** Looks up a related master record's id by name, for forms that still pick by name (e.g. booking's sender). */
export async function resolveIdByName(
  basePath: string,
  listKey: string,
  name: string,
  nameField = "name"
): Promise<string | undefined> {
  if (!name) return undefined;
  const find = async (maxAgeMs: number) => {
    const res = await http.get<Record<string, unknown>>(basePath, { maxAgeMs });
    const arr = (res[listKey] as BackendDoc[] | undefined) ?? [];
    return arr.find((doc) => doc[nameField] === name)?._id;
  };
  // The screen almost always loaded this list moments ago — reuse it, and only
  // go back to the server if the name isn't there (e.g. someone just added it).
  return (await find(LOOKUP_MAX_AGE_MS)) ?? (await find(0));
}
