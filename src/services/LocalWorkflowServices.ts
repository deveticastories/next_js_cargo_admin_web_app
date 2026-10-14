/**
 * cargo-backend has no API for the UAE store log — everything else is now
 * live (see the other `*Services.ts` files in this folder); this one stays
 * fully working but entirely local: an in-memory, this-browser-tab-only store (no network,
 * nothing persisted across a reload) standing in until a real backend
 * module exists for them.
 *
 * Each service below is a module-level singleton — created once, not per
 * render — so data survives navigating between screens in the same session.
 */
import type { UaeStoreLogEntry } from "@/types";
import type { EntityService } from "./entityHelpers";

let uid = 0;
function nextId(): string {
  uid += 1;
  return `local-${Date.now().toString(36)}-${uid.toString(36)}`;
}

export function createLocalCollectionService<T extends { id: string }>(codePrefix: string): EntityService<T> {
  let items: T[] = [];
  let seq = 0;

  return {
    async list() {
      return items;
    },
    async create(body) {
      seq += 1;
      const created = {
        ...(body as object),
        id: nextId(),
        code: `${codePrefix}-${String(seq).padStart(4, "0")}`,
      } as unknown as T;
      items = [created, ...items];
      return created;
    },
    async update(id, body) {
      let updated: T | undefined;
      items = items.map((item) => {
        if (item.id !== id) return item;
        updated = { ...item, ...(body as object) } as T;
        return updated;
      });
      if (!updated) throw new Error("Record not found.");
      return updated;
    },
    async remove(id) {
      items = items.filter((item) => item.id !== id);
    },
  };
}

export const UaeStoreLogLocalServices = createLocalCollectionService<UaeStoreLogEntry>("LOG");
