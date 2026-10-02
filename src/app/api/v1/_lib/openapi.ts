import { z } from "zod";
import { SCOPE_WORDS } from "@/lib/api-keys";
import type { RouteDef } from "./handler";

/**
 * OpenAPI 3.1 document generated from the route registry. Each operation
 * carries `x-scope` (the permission it needs) and `x-approval` (whether a
 * supervised key's call goes to the approval queue), so the assistant can
 * plan around both without trial and error.
 */

const ERROR_ENVELOPE = {
  type: "object",
  required: ["ok", "error"],
  properties: {
    ok: { const: false },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: {
          type: "string",
          enum: ["unauthorized", "forbidden", "not_found", "conflict", "invalid", "rate_limited", "unavailable", "internal"],
        },
        message: { type: "string" },
        details: {},
      },
    },
  },
} as const;

const SUCCESS_ENVELOPE = {
  type: "object",
  required: ["ok", "data"],
  properties: { ok: { const: true }, data: {}, meta: { type: "object" } },
} as const;

function jsonSchema(schema: z.ZodType, io: "input" | "output" = "input") {
  return z.toJSONSchema(schema, { io, unrepresentable: "any" });
}

function pathParams(path: string) {
  return [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

function queryParams(schema: z.ZodType | undefined) {
  if (!schema) return [];
  const js = jsonSchema(schema) as { properties?: Record<string, unknown>; required?: string[] };
  return Object.entries(js.properties ?? {}).map(([name, s]) => ({
    name,
    in: "query",
    required: js.required?.includes(name) ?? false,
    schema: s,
  }));
}

export function buildOpenApi(routes: RouteDef[], serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const op: Record<string, unknown> = {
      operationId: r.operationId,
      summary: r.summary,
      ...(r.description ? { description: r.description } : {}),
      tags: [r.tag],
      "x-scope": r.scope,
      "x-approval": r.approval ?? "never",
      ...(r.untrusted ? { "x-untrusted-fields": "clientText" } : {}),
      parameters: [...pathParams(r.path), ...queryParams(r.query)],
      responses: {
        [String(r.successStatus ?? 200)]: {
          description: "Success",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } },
        },
        // No approval queue yet: keys that ask before acting are refused.
        ...(r.approval === "always"
          ? {
              "403": {
                description: "Refused for keys that ask before acting; a person must do this.",
                content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
              },
            }
          : {}),
        default: {
          description: "Error",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
    };
    if (r.body) {
      op.requestBody = { required: true, content: { "application/json": { schema: jsonSchema(r.body) } } };
    }
    (paths[r.path] ??= {})[r.method.toLowerCase()] = op;
  }

  const scopeList = Object.entries(SCOPE_WORDS)
    .map(([s, w]) => `- \`${s}\` — ${w.can}`)
    .join("\n");

  return {
    openapi: "3.1.0",
    info: {
      title: "JetNine desk API",
      version: "1",
      description: [
        "Bearer-key API for the JetNine dispatch desk. Create and revoke keys in Admin › Settings › API keys.",
        "Responses: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Every response carries `X-Request-Id`.",
        "Send `X-Agent-Run: <run id>` on calls made during an assistant run.",
        "",
        "Permissions (`x-scope` on each operation):",
        scopeList,
      ].join("\n"),
    },
    servers: [{ url: `${serverUrl}/api/v1` }],
    security: [{ bearer: [] }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "jn_live_… key" } },
      schemas: { Success: SUCCESS_ENVELOPE, Error: ERROR_ENVELOPE },
    },
    paths,
  };
}
