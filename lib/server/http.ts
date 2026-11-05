import { NextResponse, type NextRequest } from "next/server";
import { AppError, badRequest } from "./errors";
import { assertEnv } from "./env";
import { clearSession, requireAuth } from "./auth";

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

const NO_STORE = { "Cache-Control": "no-store" };

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status, headers: NO_STORE });
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const res = NextResponse.json({ error: err.message, fields: err.fields }, { status: err.status, headers: NO_STORE });
    // A stale session (e.g. PIN changed on another device) is removed so the browser starts clean.
    if (err.status === 401) clearSession(res);
    return res;
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: NO_STORE });
}

/** Wraps a route handler: checks env config, optional auth, and turns errors into JSON. */
export function route<C = unknown>(handler: Handler<C>, opts: { auth?: boolean } = { auth: true }): Handler<C> {
  return async (req, ctx) => {
    try {
      assertEnv();
      if (opts.auth !== false) await requireAuth(req);
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 20_000) throw badRequest("Request is too large");
  try {
    const body = JSON.parse(text || "{}");
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw badRequest("Invalid request body");
  }
}

export async function idParam(ctx: { params: Promise<{ id: string }> }): Promise<string> {
  const { id } = await ctx.params;
  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw badRequest("Invalid record ID");
  return id;
}
