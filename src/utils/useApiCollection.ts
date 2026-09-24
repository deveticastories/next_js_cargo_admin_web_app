import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/utils/apiClient";
import type { RecordWithId } from "@/types";

/** How long a load may take before the UI tells the user it's still working. */
const SLOW_AFTER_MS = 6_000;

export interface ApiCollection<T extends RecordWithId> {
  items: T[];
  loading: boolean;
  /** True while a load has been running longer than `SLOW_AFTER_MS` — lets the UI say "still loading". */
  slow: boolean;
  /** Message from the last failed request, if any (list, create, update, or remove). */
  error: string | null;
  create: (body: Record<string, unknown>) => Promise<T>;
  update: (id: string, body: Record<string, unknown>) => Promise<T>;
  remove: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Fetches a REST collection on mount and keeps local state in sync with
 * create/update/remove calls, so a screen never has to compute its own
 * next-id or duplicate-check — the backend already does both. One call to
 * this per entity in `CargoDataProvider` is what every screen reads from.
 */
export function useApiCollection<T extends RecordWithId>(endpoint: string): ApiCollection<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the latest refetch may write state — an older, slower response must not
  // overwrite newer data (e.g. a retry that finishes before the original request).
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSlow(false);
    setError(null);
    const slowTimer = setTimeout(() => {
      if (requestId === requestIdRef.current) setSlow(true);
    }, SLOW_AFTER_MS);
    try {
      const data = await api.get<T[]>(endpoint);
      if (requestId === requestIdRef.current) setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      // Keep whatever was already loaded on screen; just report the failure.
      if (requestId === requestIdRef.current) {
        setError(err instanceof ApiError ? err.message : "Failed to load data.");
      }
    } finally {
      clearTimeout(slowTimer);
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setSlow(false);
      }
    }
  }, [endpoint]);

  useEffect(() => {
    // Deferred a tick so the initial fetch's setState calls land in their
    // own microtask rather than synchronously inside the effect body.
    queueMicrotask(() => {
      refetch();
    });
  }, [refetch]);

  // A failed load retries on its own when the connection comes back or the user returns to the tab.
  useEffect(() => {
    if (!error) return;
    const retryIfFailed = () => {
      if (document.visibilityState === "visible") refetch();
    };
    window.addEventListener("online", retryIfFailed);
    document.addEventListener("visibilitychange", retryIfFailed);
    return () => {
      window.removeEventListener("online", retryIfFailed);
      document.removeEventListener("visibilitychange", retryIfFailed);
    };
  }, [error, refetch]);

  const create = useCallback(
    async (body: Record<string, unknown>) => {
      const created = await api.post<T>(endpoint, body);
      setItems((prev) => [created, ...prev]);
      return created;
    },
    [endpoint]
  );

  const update = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const updated = await api.patch<T>(`${endpoint}/${id}`, body);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    },
    [endpoint]
  );

  const remove = useCallback(
    async (id: string) => {
      await api.delete(`${endpoint}/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [endpoint]
  );

  return { items, loading, slow, error, create, update, remove, refetch };
}
