/**
 * Transport layer for the cargo-backend Express API (see cargo-backend/app.ts),
 * replacing the old same-origin `/api/*` Next.js routes. Every service in
 * `src/services` goes through this.
 *
 * Auth model is simpler than the old one: cargo-backend's `POST /auth/login`
 * hands back a single Bearer JWT (1 day, no refresh endpoint) instead of an
 * access/refresh cookie pair — see `cargo-backend/src/middleware/verifyToken.ts`.
 * The token is kept in a plain (non-httpOnly) cookie, set from JS right after
 * login, so `src/proxy.ts` can still read it on the server for the optimistic
 * `/admin` gate, while the browser attaches it as `Authorization: Bearer`.
 */

import { API_BASE_URL } from "@/constants/ApiConstants";
import { emitSessionChange } from "./sessionEvents";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** `status` for failures that never got an HTTP response (offline, DNS, timeout). */
export const NETWORK_ERROR_STATUS = 0;

export const TOKEN_COOKIE = "cargo_backend_token";

const BASE_URL = API_BASE_URL;

const READ_TIMEOUT_MS = 25_000;
const WRITE_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [800, 2_000];
const RETRYABLE_STATUSES = new Set([NETWORK_ERROR_STATUS, 408, 429, 502, 503, 504]);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Decodes (never verifies — there's no shared secret in the browser) a JWT's payload. */
export function decodeJwtPayload(token: string): { exp?: number; [key: string]: unknown } | null {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return readCookie(TOKEN_COOKIE);
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now();
}

export function setToken(token: string): void {
  if (typeof document === "undefined") return;
  const payload = decodeJwtPayload(token);
  const maxAge = payload?.exp ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000)) : 60 * 60 * 24;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  invalidateGetCache();
  emitSessionChange();
}

export function clearToken(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  invalidateGetCache();
  emitSessionChange();
}

let redirectingToLogin = false;

function redirectToLogin(reason?: "expired") {
  if (redirectingToLogin || typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  redirectingToLogin = true;
  const params = new URLSearchParams({ from: window.location.pathname + window.location.search });
  if (reason) params.set("reason", reason);
  window.location.replace(`/login?${params}`);
}

/**
 * Ends a session whose token is expired or rejected: drops the token (which
 * also wipes cached data — see `sessionEvents`) and sends the user to
 * `/login`, which explains why. Safe to call repeatedly.
 */
export function expireSession(): void {
  if (getToken()) clearToken();
  redirectToLogin("expired");
}

/**
 * cargo-backend's `verifyToken` doesn't use one status for a bad session:
 * a missing token is 401, but `jwt.verify()` *throws* on an expired or
 * tampered token and its catch block answers 400 "Token has expired" — so
 * the status alone isn't enough; the message is what identifies it.
 */
const SESSION_ERROR_MESSAGES = new Set([
  "Unauthorized. Please login",
  "Invalid token. Please login again",
  "Token has expired. Please login again",
]);

function isSessionError(status: number, message: string): boolean {
  if (status === 401) return true;
  return (status === 400 || status === 403) && SESSION_ERROR_MESSAGES.has(message);
}

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function networkErrorMessage(timedOut: boolean): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You're offline. Check your internet connection and try again.";
  }
  if (timedOut) return "The server is taking too long to respond. Please try again.";
  return "Couldn't reach the server. Check your connection and try again.";
}

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

/** cargo-backend's envelope is `{ success, message?, ...data }` — never `{ error }`. */
async function errorFromResponse(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (body.message) return new ApiError(body.message, res.status);
  if (res.status >= 500) return new ApiError("The server ran into a problem. Please try again in a moment.", res.status);
  return new ApiError(`Request failed (${res.status}).`, res.status);
}

export interface RequestOptions {
  /** Set false for the login call itself — nothing to attach yet, and its own 401 shouldn't redirect. */
  auth?: boolean;
}

async function request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth ?? true;
  const method = (init.method ?? "GET").toUpperCase();
  const isRead = method === "GET";
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    // Already expired (or gone, e.g. logged out in another tab) — don't spend a
    // round trip just to be told so.
    if (!isTokenValid(token)) {
      expireSession();
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401);
    }
    headers.Authorization = `Bearer ${token}`;
  }
  const requestInit: RequestInit = { ...init, headers };
  const maxAttempts = isRead ? RETRY_DELAYS_MS.length + 1 : 1;

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);

    let res: Response;
    try {
      res = await fetchWithTimeout(`${BASE_URL}${path}`, requestInit, isRead ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
    } catch (err) {
      lastError = err as ApiError;
      continue;
    }

    if (!res.ok) {
      lastError = await errorFromResponse(res);
      if (auth && isSessionError(res.status, lastError.message)) {
        expireSession();
        throw new ApiError(SESSION_EXPIRED_MESSAGE, 401);
      }
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

export interface GetOptions extends RequestOptions {
  /**
   * Reuse a previous response for this exact path if it's younger than this.
   * Default 0: always hit the network (identical requests already in flight
   * are still shared). Any write clears the cache, so only lookups that can
   * tolerate a slightly old list (e.g. name -> id) should set this.
   */
  maxAgeMs?: number;
}

// Every API call crosses a ~300ms round trip (plus a CORS preflight, since
// requests carry `Authorization`) over HTTP/1.1's 6-connections-per-host limit,
// so not sending the same GET twice matters: e.g. senders and receivers both
// list `/customers`, and saving a booking re-reads lists the screen already has.
const getCache = new Map<string, { at: number; data: unknown }>();
const inflightGets = new Map<string, Promise<unknown>>();
let cacheEpoch = 0;

function invalidateGetCache(): void {
  cacheEpoch++;
  getCache.clear();
  inflightGets.clear();
}

function cachedGet<T>(path: string, options: GetOptions = {}): Promise<T> {
  const maxAgeMs = options.maxAgeMs ?? 0;
  const hit = maxAgeMs > 0 ? getCache.get(path) : undefined;
  if (hit && Date.now() - hit.at < maxAgeMs) return Promise.resolve(hit.data as T);

  const pending = inflightGets.get(path);
  if (pending) return pending as Promise<T>;

  const epoch = cacheEpoch;
  const promise: Promise<T> = request<T>(path, {}, options)
    .then((data) => {
      // A write that landed while this was in flight makes the response suspect — don't keep it.
      if (epoch === cacheEpoch) getCache.set(path, { at: Date.now(), data });
      return data;
    })
    .finally(() => {
      if (inflightGets.get(path) === promise) inflightGets.delete(path);
    });
  inflightGets.set(path, promise);
  return promise;
}

/** Any write may change what a cached GET would return (often on other endpoints too), so drop them all. */
async function write<T>(path: string, init: RequestInit, options?: RequestOptions): Promise<T> {
  try {
    return await request<T>(path, init, options);
  } finally {
    invalidateGetCache();
  }
}

export const http = {
  get: <T>(path: string, options?: GetOptions) => cachedGet<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    write<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    write<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    write<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }, options),
  delete: <T>(path: string, options?: RequestOptions) => write<T>(path, { method: "DELETE" }, options),
};
