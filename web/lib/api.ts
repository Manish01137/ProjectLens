import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { auth } from "@/auth";
import { MlUnavailableError } from "./ml";
import { rateLimit } from "./rate-limit";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const jsonError = (status: number, error: string, code?: string, headers?: HeadersInit) =>
  NextResponse.json({ error, code }, { status, headers });

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (args: { req: Request; userId: string; params: P }) => Promise<Response>;

/** Logged-in only, 30 requests per minute per user, consistent JSON errors. */
export function withUser<P = Record<string, never>>(handler: Handler<P>, opts: { limit?: number } = {}) {
  return async (req: Request, ctx: Ctx<P>) => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return jsonError(401, "Please sign in", "unauthorized");
    // 30 requests per minute per user, counted per resource (/api/chat, /api/saved, ...)
    const bucket = new URL(req.url).pathname.split("/").slice(0, 3).join("/");
    const rl = rateLimit(`api:${userId}:${bucket}`, opts.limit ?? 30);
    if (!rl.ok) {
      return jsonError(429, "You're going a little fast. Try again in a moment.", "rate_limited", {
        "Retry-After": String(rl.retryAfter),
      });
    }
    try {
      return await handler({ req, userId, params: ctx?.params ? await ctx.params : ({} as P) });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) return jsonError(err.status, err.message, err.code);
  if (err instanceof ZodError) {
    return jsonError(400, err.issues[0]?.message ?? "Invalid request", "invalid");
  }
  if (err instanceof MlUnavailableError) {
    return jsonError(503, "Recommendations are warming up, try again in a moment.", "ml_unavailable");
  }
  console.error("[api] unexpected error", err);
  return jsonError(500, "Something went wrong on our side. Please try again.", "server_error");
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON", "invalid_json");
  }
  return schema.parse(raw);
}
