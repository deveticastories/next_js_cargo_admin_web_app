/**
 * Small fetch wrapper every frontend data call goes through. What it
 * handles so individual screens don't have to:
 *
 *  - Sends cookies with every request (`credentials: "include"`) — the
 *    admin's access/refresh tokens live in httpOnly cookies, never in JS.
 *  - On a 401, tries `POST /api/auth/refresh` once and retries the original
 *    request — the "silent refresh" half of the access/refresh token pair.
 *    If the refresh also fails, the session is over: the browser is sent to
 *    `/login` instead of every screen showing its own "failed" error.
 *  - A timeout, so a request stuck on a bad connection fails with a clear
 *    message instead of spinning forever.
 *  - Automatic retries (with backoff) for GETs that hit a network error, a
 *    timeout, or a temporary server error (502/503/504). Writes are never
 *    auto-retried — repeating a POST could create a duplicate record.
 *  - Readable error messages for every failure (offline, timeout, server).
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** `status` for failures that never got an HTTP response (offline, DNS, timeout). */
export const NETWORK_ERROR_STATUS = 0;

const READ_TIMEOUT_MS = 25_000;
const WRITE_TIMEOUT_MS = 30_000;
/** Delay before each GET retry — two retries, so at most three attempts. */
const RETRY_DELAYS_MS = [800, 2_000];
const RETRYABLE_STATUSES = new Set([NETWORK_ERROR_STATUS, 408, 429, 502, 503, 504]);

let refreshInFlight: Promise<boolean> | null = null;
let redirectingToLogin = false;

function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Session is gone for good (refresh token expired/revoked) — send the user to sign in again, once. */
function redirectToLogin() {
  if (redirectingToLogin || typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  redirectingToLogin = true;
  const from = window.location.pathname + window.location.search;
  window.location.replace(`/login?from=${encodeURIComponent(from)}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function networkErrorMessage(timedOut: boolean): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You're offline. Check your internet connection and try again.";
  }
  if (timedOut) return "The server is taking too long to respond. Please try again.";
  return "Couldn't reach the server. Check your connection and try again.";
}

/** One fetch attempt with a timeout. Throws `ApiError` with status 0 if no response arrived. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError(networkErrorMessage(timedOut), NETWORK_ERROR_STATUS);
  } finally {
    clearTimeout(timer);
  }
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (body.error) return new ApiError(body.error, res.status);
  if (res.status >= 500) return new ApiError("The server ran into a problem. Please try again in a moment.", res.status);
  return new ApiError(`Request failed (${res.status}).`, res.status);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const isRead = method === "GET";
  // Auth endpoints report their own 401s (e.g. "Invalid email or password") — never refresh/redirect on them.
  const isAuthEndpoint = path.startsWith("/auth/");
  const requestInit: RequestInit = {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  };
  const maxAttempts = isRead ? RETRY_DELAYS_MS.length + 1 : 1;

  let triedRefresh = false;
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);

    let res: Response;
    try {
      res = await fetchWithTimeout(`/api${path}`, requestInit, isRead ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
    } catch (err) {
      lastError = err as ApiError;
      continue;
    }

    if (res.status === 401 && !isAuthEndpoint) {
      if (!triedRefresh) {
        triedRefresh = true;
        if (await refreshAccessToken()) {
          attempt--; // the retry after a successful refresh doesn't count against the retry budget
          continue;
        }
      }
      redirectToLogin();
      throw new ApiError("Your session has expired. Please sign in again.", 401);
    }

    if (!res.ok) {
      lastError = await errorFromResponse(res);
      if (RETRYABLE_STATUSES.has(res.status)) continue;
      throw lastError;
    }

    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError("The server sent an invalid response. Please try again.", res.status);
    }
  }

  throw lastError ?? new ApiError(networkErrorMessage(false), NETWORK_ERROR_STATUS);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
