import { SignJWT, jwtVerify } from "jose";

/**
 * Signing/verifying the two JWTs the auth routes hand out. Access tokens
 * are short-lived and checked on every request (`proxy.ts`, `requireAuth`);
 * refresh tokens are long-lived and only ever sent to `/api/auth/refresh`.
 * Both are stored as httpOnly cookies (see `authCookies.ts`) — the frontend
 * never reads or stores the raw token strings itself.
 */

export const ACCESS_TOKEN_COOKIE = "cargo_access_token";
export const REFRESH_TOKEN_COOKIE = "cargo_refresh_token";

const ACCESS_TOKEN_TTL = "15m";
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL = "7d";
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  sub: string;
  v: number;
}

function secret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): Uint8Array {
  const raw = process.env[name];
  if (!raw) throw new Error(`Missing ${name} environment variable. Copy .env.example to .env.local and set it.`);
  return new TextEncoder().encode(raw);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(secret("JWT_ACCESS_SECRET"));
}

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(secret("JWT_REFRESH_SECRET"));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret("JWT_ACCESS_SECRET"));
  return payload as unknown as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, secret("JWT_REFRESH_SECRET"));
  return payload as unknown as RefreshTokenPayload;
}
