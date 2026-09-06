import { NextResponse } from "next/server";
import mongoose from "mongoose";

/** Throw this from inside a route handler for an error whose message/status is safe to send back to the client. */
export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Parses a request's JSON body, turning a malformed/empty body into a clean 400 instead of an uncaught parse exception. */
export async function readJsonBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError("Request body must be valid JSON.", 400);
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;
}

/**
 * Wraps a route handler so every error it throws — an explicit `HttpError`,
 * a Mongoose validation failure, a duplicate-key write, or anything
 * unexpected — becomes a clean JSON response instead of a raw stack trace.
 * Every handler in `backend/controllers` and every custom route goes
 * through this, so error shape is consistent across the whole API.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) return jsonError(err.message, err.status);
      if (err instanceof mongoose.Error.ValidationError) return jsonError(err.message, 400);
      if (isDuplicateKeyError(err)) return jsonError("A record with these values already exists.", 409);
      console.error(err);
      return jsonError("Unexpected server error.", 500);
    }
  };
}
