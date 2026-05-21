import { headers } from "next/headers";
import { db } from "@/db";
import { auditLog, type NewAuditLog } from "@/db/schema/audit";

type SubjectType = NewAuditLog["subjectType"];

type LogInput = {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  subjectType: SubjectType;
  subjectId?: string | null;
  subjectCode?: string | null;
  diff?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Append an audit row from a Server Action. Best-effort — never throws.
 * Callers don't await failure handling; if the log fails, the operational
 * action still succeeds (we'd rather miss an audit row than refuse a
 * legitimate trip status change).
 *
 * Pulls ip + user-agent from the request headers when available so dispute
 * arbitration ("you said you cancelled at 14:32 — here's the row, here's
 * the IP, here's the UA") doesn't need a separate logging layer.
 */
export async function logAudit(input: LogInput): Promise<void> {
  try {
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      const hdrs = await headers();
      ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      ua = hdrs.get("user-agent")?.slice(0, 500) ?? null;
    } catch {
      // headers() throws outside a request scope (e.g. from a background
      // job). Audit still fires; just no request context.
    }

    await db.insert(auditLog).values({
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      subjectCode: input.subjectCode ?? null,
      diff: input.diff ?? null,
      metadata: input.metadata ?? null,
      ip,
      userAgent: ua,
    } satisfies NewAuditLog);
  } catch (err) {
    // Audit failure must not block the operational action.
    console.error("audit logging failed", { input, err });
  }
}
