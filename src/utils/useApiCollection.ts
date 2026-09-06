import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/utils/apiClient";
import type { RecordWithId } from "@/types";

export interface ApiCollection<T extends RecordWithId> {
  items: T[];
  loading: boolean;
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
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.get<T[]>(endpoint));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    // Deferred a tick so the initial fetch's setState calls land in their
    // own microtask rather than synchronously inside the effect body.
    queueMicrotask(() => {
      refetch();
    });
  }, [refetch]);

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

  return { items, loading, error, create, update, remove, refetch };
}
