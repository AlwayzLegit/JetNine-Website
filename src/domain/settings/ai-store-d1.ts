import { count, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { aiProviders, aiRoutes } from "@/db/d1/schema/ai";
import type { AiProviderRow, AiProviderStore, AiRouteRow } from "./ai-store";

// The D1 (SQLite) side of the AI provider store (OPS-166). Same methods and the
// same results as ai-store-pg.ts, on the D1 twin tables (src/db/d1/schema,
// OPS-100). The client is passed in so a test can hand it a real SQLite.
// D1 enforces foreign keys, so deleting a provider clears the routes that
// pointed at it (on delete set null), as on Postgres.

// The D1 client from d1Db(). A test casts a sqlite-proxy over node:sqlite to it.
type D1Client = DrizzleD1Database;

// The D1 row has the same fields and types as the Postgres row (Date, boolean,
// string ids), so rows go back to callers as they are.
const asProvider = (row: unknown) => row as AiProviderRow;
const asRoute = (row: unknown) => row as AiRouteRow;

export function d1AiProviderStore(db: D1Client): AiProviderStore {
  return {
    async listProviders() {
      const rows = await db.select().from(aiProviders);
      return rows.map(asProvider);
    },

    async providerByKind(kind) {
      const [row] = await db.select().from(aiProviders).where(eq(aiProviders.provider, kind));
      return row ? asProvider(row) : undefined;
    },

    async insertProvider(values) {
      const now = new Date();
      const [row] = await db
        .insert(aiProviders)
        .values({ ...values, createdAt: now, updatedAt: now })
        .returning();
      return asProvider(row);
    },

    async updateProvider(id, patch) {
      const [row] = await db.update(aiProviders).set(patch).where(eq(aiProviders.id, id)).returning();
      return row ? asProvider(row) : undefined;
    },

    async updateProviderByKind(kind, patch) {
      const [row] = await db.update(aiProviders).set(patch).where(eq(aiProviders.provider, kind)).returning();
      return row ? asProvider(row) : undefined;
    },

    async deleteByKind(kind) {
      const [row] = await db
        .delete(aiProviders)
        .where(eq(aiProviders.provider, kind))
        .returning({ id: aiProviders.id });
      return row ?? null;
    },

    async getRoute(purpose) {
      const [row] = await db.select().from(aiRoutes).where(eq(aiRoutes.purpose, purpose));
      return row ? asRoute(row) : undefined;
    },

    async upsertRoute(purpose, primaryProviderId, fallbackProviderId, updatedAt) {
      await db
        .insert(aiRoutes)
        .values({ purpose, primaryProviderId, fallbackProviderId, updatedAt })
        .onConflictDoUpdate({
          target: aiRoutes.purpose,
          set: { primaryProviderId, fallbackProviderId, updatedAt },
        });
    },

    async countEnabled() {
      const [row] = await db.select({ n: count() }).from(aiProviders).where(eq(aiProviders.enabled, true));
      return row?.n ?? 0;
    },
  };
}
