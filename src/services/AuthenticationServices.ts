/**
 * Auth against cargo-backend's one and only auth endpoint: `POST /auth/login`
 * (see cargo-backend/src/modules/auth). There's no `/logout`, `/me`, or
 * `/refresh` on the backend — the JWT is stateless, so "logout" just clears
 * the local token, and "who's signed in" is read back from what login
 * returned (cached here) instead of a network call.
 */
import { http, getToken, setToken, clearToken, isTokenValid, ApiError, expireSession, decodeJwtPayload } from "./httpClient";
import { onSessionChange } from "./sessionEvents";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: { _id: string; email: string; role: string; [key: string]: unknown };
}

const USER_STORAGE_KEY = "cargo_backend_user";

function persistUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function clearUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

// However the token went away (logout, expiry, a 401), the cached identity goes with it.
onSessionChange(() => {
  if (!getToken()) clearUser();
});

export async function login(email: string, password: string): Promise<AuthUser> {
  const body = await http.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, { email, password }, { auth: false });
  if (!body.token) throw new ApiError(body.message || "Invalid email or password.", 401);
  setToken(body.token);
  const user: AuthUser = { id: body.user._id, email: body.user.email, role: body.user.role };
  persistUser(user);
  return user;
}

export function logout(): void {
  clearToken();
  clearUser();
}

export function getCurrentUser(): AuthUser | null {
  if (!isTokenValid(getToken())) return null;
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return isTokenValid(getToken());
}

/** Milliseconds until the current token expires (0 if it already has or there is none). */
export function msUntilExpiry(): number {
  const token = getToken();
  if (!isTokenValid(token)) return 0;
  const exp = decodeJwtPayload(token!)?.exp ?? 0;
  return Math.max(0, exp * 1000 - Date.now());
}

export { expireSession };
