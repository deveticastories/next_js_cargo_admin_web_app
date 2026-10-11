import { ApiError } from "@/services/httpClient";
import { onSessionChange } from "@/services/sessionEvents";
import type { EntityService } from "@/services/entityHelpers";
import type { RecordWithId } from "@/types";

/** How long a load may take before the UI tells the user it's still working. */
const SLOW_AFTER_MS = 6_000;
/** Data older than this is quietly re-fetched the next time a screen uses it (or the tab regains focus). */
const STALE_AFTER_MS = 60_000;
/** Bump when a service's `toFrontend` shape changes, so old cached lists are ignored. */
const STORAGE_PREFIX = "cc_collection_v1:";

export interface ApiCollection<T extends RecordWithId> {
  items: T[];
  /** True only while there's nothing to show yet — background refreshes of already-shown data don't flip it. */
  loading: boolean;
  /** True while a first load has been running longer than `SLOW_AFTER_MS` — lets the UI say "still loading". */
  slow: boolean;
  /** Message from the last failed request, if any (list, create, update, or remove). */
  error: string | null;
  create: (body: Record<string, unknown>) => Promise<T>;
  update: (id: string, body: Record<string, unknown>) => Promise<T>;
  remove: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export interface CollectionStore<T extends RecordWithId> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ApiCollection<T>;
  getServerSnapshot(): ApiCollection<T>;
  /**
   * Marks the collection as used by the current screen: loads it the first
   * time, and re-validates it in the background once it's gone stale.
   * Safe to call during render — the fetch itself is deferred.
   */
  request(): void;
  /** Whether any screen has used this collection yet this session. */
  readonly requested: boolean;
  refetch(): Promise<void>;
}

const allStores = new Set<{ requested: boolean; revalidate(): void; reset(): void }>();
let globalListenersInstalled = false;

function installGlobalListeners() {
  if (globalListenersInstalled || typeof window === "undefined") return;
  globalListenersInstalled = true;
  // Coming back to the tab or back online: refresh whatever the user has been looking at, if stale or failed.
  const revalidateAll = () => {
    if (document.visibilityState !== "visible") return;
    allStores.forEach((store) => store.requested && store.revalidate());
  };
  window.addEventListener("online", revalidateAll);
  document.addEventListener("visibilitychange", revalidateAll);
  // A different user (or nobody) — never show the previous session's data.
  onSessionChange(() => {
    allStores.forEach((store) => store.reset());
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) window.localStorage.removeItem(key);
      }
    } catch {
      // Storage unavailable — nothing was cached there anyway.
    }
  });
}

function readStored<T>(key: string | null): T[] | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored<T>(key: string | null, items: T[]) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Quota exceeded / private mode — the in-memory copy still works.
  }
}

export interface CollectionStoreOptions {
  /**
   * Keep the last loaded list in `localStorage` under this key so a reload
   * paints instantly from it while fresh data loads (stale-while-revalidate).
   * Leave unset for local-only services, whose data is in memory anyway.
   */
  persistKey?: string;
}

/**
 * One module-level store per entity (see `CargoDataProvider`): holds the
 * list, loads it lazily the first time a screen reads it, and keeps it in
 * sync with create/update/remove calls, so a screen never has to compute its
 * own next-id or duplicate-check. Lives outside React so data survives
 * navigation and is shared by every screen that reads it.
 */
export function createCollectionStore<T extends RecordWithId>(
  service: EntityService<T>,
  options: CollectionStoreOptions = {}
): CollectionStore<T> {
  const storageKey = options.persistKey ? STORAGE_PREFIX + options.persistKey : null;
  const listeners = new Set<() => void>();

  let items: T[] = [];
  let hasData = false;
  let inFlight = false;
  let slow = false;
  let error: string | null = null;
  let loadedAt = 0;
  let requested = false;
  let scheduled = false;
  let hydrated = false;
  // Only the latest load may write state — an older, slower response must not
  // overwrite newer data (e.g. a retry that finishes before the original request).
  let requestId = 0;
  let snapshot: ApiCollection<T> | null = null;

  const emit = () => {
    snapshot = null;
    listeners.forEach((listener) => listener());
  };

  const hydrate = () => {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    const stored = readStored<T>(storageKey);
    if (stored) {
      items = stored;
      hasData = true; // `loadedAt` stays 0, so it's re-validated as soon as a screen uses it.
    }
  };

  const setItems = (next: T[]) => {
    items = next;
    writeStored(storageKey, items);
    emit();
  };

  async function refetch(): Promise<void> {
    if (typeof window === "undefined") return;
    hydrate();
    requested = true;
    scheduled = false;
    const id = ++requestId;
    inFlight = true;
    slow = false;
    error = null;
    emit();
    const slowTimer = setTimeout(() => {
      if (id === requestId && !hasData) {
        slow = true;
        emit();
      }
    }, SLOW_AFTER_MS);
    try {
      const data = await service.list();
      if (id === requestId) {
        items = Array.isArray(data) ? data : [];
        hasData = true;
        loadedAt = Date.now();
        writeStored(storageKey, items);
      }
    } catch (err) {
      // Keep whatever was already loaded on screen; just report the failure.
      if (id === requestId) error = err instanceof ApiError ? err.message : "Failed to load data.";
    } finally {
      clearTimeout(slowTimer);
      if (id === requestId) {
        inFlight = false;
        slow = false;
        emit();
      }
    }
  }

  const schedule = () => {
    if (scheduled || inFlight) return;
    scheduled = true;
    queueMicrotask(() => {
      if (scheduled) refetch();
    });
  };

  const create = async (body: Record<string, unknown>) => {
    const created = await service.create(body);
    setItems([created, ...items]);
    return created;
  };

  const update = async (id: string, body: Record<string, unknown>) => {
    const updated = await service.update(id, body);
    setItems(items.map((item) => (item.id === id ? updated : item)));
    return updated;
  };

  const remove = async (id: string) => {
    await service.remove(id);
    setItems(items.filter((item) => item.id !== id));
  };

  const serverSnapshot: ApiCollection<T> = {
    items: [],
    loading: true,
    slow: false,
    error: null,
    create,
    update,
    remove,
    refetch,
  };

  const store = {
    get requested() {
      return requested;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      hydrate();
      // Not yet requested counts as loading too — a screen sees the same thing either way.
      snapshot ??= { items, loading: !hasData && !error, slow, error, create, update, remove, refetch };
      return snapshot;
    },
    getServerSnapshot() {
      return serverSnapshot;
    },
    request() {
      if (typeof window === "undefined") return;
      requested = true;
      // A failed load is retried by the banner's Retry button or on focus/online —
      // not on every render, which would loop while the server is down.
      if (error) return;
      if (Date.now() - loadedAt > STALE_AFTER_MS) schedule();
    },
    revalidate() {
      if (error || Date.now() - loadedAt > STALE_AFTER_MS) schedule();
    },
    reset() {
      requestId++;
      items = [];
      hasData = false;
      inFlight = false;
      slow = false;
      error = null;
      loadedAt = 0;
      requested = false;
      scheduled = false;
      hydrated = true; // its stored copy is being cleared too
      emit();
    },
    refetch,
  };

  allStores.add(store);
  installGlobalListeners();
  return store;
}
