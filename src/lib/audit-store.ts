import { d1Db, db, dbTarget } from "@/db";
import { auditLog as d1AuditLog } from "@/db/d1/schema/audit";
import { auditLog, type NewAuditLog } from "@/db/schema/audit";
import type { DrizzleD1Database } from "drizzle-orm/d1";

// The audit log's one door to the database (OPS-123): logAudit() appends through an
// AuditStore. One adapter per database, chosen per call by dbTarget(): Postgres until the
// move, D1 where DB_TARGET is "d1" (staging first; the code refuses "d1" in production, see
// src/db/target.mjs). Append only. The read side is src/domain/history/store.ts.

export interface AuditStore {
  insertAudit(values: NewAuditLog): Promise<void>;
}

export function pgAuditStore(): AuditStore {
  return {
    async insertAudit(values) {
      await db.insert(auditLog).values(values);
    },
  };
}

/** The D1 side. The client is passed in so a test can hand it a real SQLite. */
export function d1AuditStore(client: DrizzleD1Database): AuditStore {
  return {
    async insertAudit(values) {
      await client.insert(d1AuditLog).values(values);
    },
  };
}

/** The store for this call. A d1 target with no binding throws, loudly; logAudit() catches it as any audit failure. */
export function auditStore(): AuditStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1AuditStore(client);
  }
  return pgAuditStore();
}
