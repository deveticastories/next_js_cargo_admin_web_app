/**
 * Tiny pub/sub fired whenever the signed-in session changes (login, logout,
 * or a 401 dropping the token). Lets caches that live outside `httpClient`
 * (see `src/utils/useApiCollection.ts`) throw away the previous user's data
 * without `httpClient` having to import them — that would be a cycle.
 */

const listeners = new Set<() => void>();

export function onSessionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSessionChange(): void {
  listeners.forEach((listener) => listener());
}
