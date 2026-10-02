import { after, type NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { db } from "@/db";
import { apiRequests } from "@/db/schema/api";
import { authenticateApiKey, clientIp } from "@/lib/api-auth";
import type { Scope } from "@/lib/api-keys";
import type { Actor } from "@/domain/actor";
import { err, type Result } from "@/domain/result";
import { failure, success } from "./envelope";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RouteContext = {
  actor: Actor;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  req: Request;
};

/** What a route returns: data, plus an optional status (201, 202) and meta. */
export type RouteOutput = { data: unknown; status?: number; meta?: Record<string, unknown> };

export type RouteDef = {
  method: Method;
  /** OpenAPI path template under /api/v1, e.g. "/blog/posts/{slug}". */
  path: string;
  operationId: string;
  summary: string;
  description?: string;
  tag: string;
  /** Scope required, or "any" for any valid key (discovery endpoints). */
  scope: Scope | "any";
  /** For supervised (assistant) keys: does this go to the approval queue? */
  approval?: "never" | "conditional" | "always";
  query?: z.ZodType;
  body?: z.ZodType;
  /** false = pass the raw JSON body to run(), which validates it itself. */
  validateBody?: boolean;
  /** Response fields that carry client-written text (treat as data). */
  untrusted?: boolean;
  successStatus?: number;
  run: (ctx: RouteContext) => Promise<Result<RouteOutput>>;
};

const MAX_BODY = 256 * 1024;

/** Read the body as text, giving up (null) once it passes `max` bytes — chunked bodies included. */
async function readCapped(req: Request, max: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Turn a RouteDef into a Next.js route handler. */
export function apiHandler(def: RouteDef) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    const started = Date.now();
    const requestId = randomUUID();
    let keyId: string | null = null;
    let runId: string | null = null;
    let status = 500;
    let errorCode: string | null = null;

    const finish = (res: NextResponse) => {
      status = res.status;
      const ip = clientIp(req);
      const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;
      // Log only calls that presented a recognisable key; anonymous probes
      // are counted by the per-IP failure limiter instead.
      if (keyId) {
        const row = {
          keyId,
          method: def.method,
          route: def.path,
          status,
          errorCode,
          durationMs: Date.now() - started,
          ip,
          ua,
          runId,
          requestId,
        };
        after(async () => {
          try {
            await db.insert(apiRequests).values(row);
          } catch {
            // best-effort
          }
        });
      }
      return res;
    };

    const write = def.method !== "GET";
    const auth = await authenticateApiKey(req, { write });
    if (!auth.ok) {
      errorCode = auth.code;
      const failedKey = (auth.details as { keyId?: unknown } | undefined)?.keyId;
      if (typeof failedKey === "string") keyId = failedKey;
      return finish(failure(requestId, auth));
    }
    const actor: Actor = { ...auth.value, requestId };
    keyId = actor.key?.id ?? null;
    runId = actor.runId ?? null;

    if (def.scope !== "any" && !actor.scopes.has(def.scope)) {
      errorCode = "forbidden";
      return finish(failure(requestId, err("forbidden", `This key does not have the "${def.scope}" permission.`)));
    }

    // Supervised keys (the assistant) must ask a person first. Until the
    // approval queue exists, "always" routes are refused for them outright.
    if (def.approval === "always" && actor.key?.supervised) {
      errorCode = "forbidden";
      return finish(
        failure(requestId, err("forbidden", "This key asks before acting, and this action needs a person's OK. Ask the desk to do it.")),
      );
    }

    const params = ((await ctx.params) ?? {}) as Record<string, string>;

    let query: Record<string, unknown> = {};
    if (def.query) {
      const raw = Object.fromEntries(new URL(req.url).searchParams.entries());
      const parsed = def.query.safeParse(raw);
      if (!parsed.success) {
        errorCode = "invalid";
        return finish(failure(requestId, err("invalid", "Invalid query parameters.", parsed.error.issues)));
      }
      query = parsed.data as Record<string, unknown>;
    }

    let body: unknown = undefined;
    if (def.body || def.method === "POST" || def.method === "PUT" || def.method === "PATCH") {
      const len = Number(req.headers.get("content-length") ?? "0");
      if (len > MAX_BODY) {
        errorCode = "invalid";
        return finish(failure(requestId, err("invalid", "Request body is too large."), 413));
      }
      const text = await readCapped(req, MAX_BODY);
      if (text === null) {
        errorCode = "invalid";
        return finish(failure(requestId, err("invalid", "Request body is too large."), 413));
      }
      if (text.trim()) {
        try {
          body = JSON.parse(text);
        } catch {
          errorCode = "invalid";
          return finish(failure(requestId, err("invalid", "Body must be valid JSON.")));
        }
      }
      if (def.body && def.validateBody !== false) {
        const parsed = def.body.safeParse(body ?? {});
        if (!parsed.success) {
          errorCode = "invalid";
          return finish(failure(requestId, err("invalid", "Invalid request body.", parsed.error.issues)));
        }
        body = parsed.data;
      }
    }

    try {
      const out = await def.run({ actor, params, query, body, req });
      if (!out.ok) {
        errorCode = out.code;
        return finish(failure(requestId, out));
      }
      return finish(success(requestId, out.value.data, out.value.status ?? def.successStatus ?? 200, out.value.meta));
    } catch (e) {
      console.error(`[api] ${def.operationId} failed`, e);
      errorCode = "internal";
      return finish(failure(requestId, err("internal", "Something went wrong. The request id helps us find it.")));
    }
  };
}
