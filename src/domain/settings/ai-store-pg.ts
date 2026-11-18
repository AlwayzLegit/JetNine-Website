import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiProviders, aiRoutes } from "@/db/schema/ai";
import type { AiProviderStore } from "./ai-store";

// The Postgres side of the AI provider store (OPS-166): the queries that lived
// in src/lib/ai-providers.ts and src/domain/reference/queries.ts, moved as
// they were.

export function pgAiProviderStore(): AiProviderStore {
  return {
    async listProviders() {
      return db.select().from(aiProviders);
    },

    async providerByKind(kind) {
      const [row] = await db.select().from(aiProviders).where(eq(aiProviders.provider, kind));
      return row;
    },

    async insertProvider(values) {
      const [row] = await db.insert(aiProviders).values(values).returning();
      return row;
    },

    async updateProvider(id, patch) {
      const [row] = await db.update(aiProviders).set(patch).where(eq(aiProviders.id, id)).returning();
      return row;
    },

    async updateProviderByKind(kind, patch) {
      const [row] = await db.update(aiProviders).set(patch).where(eq(aiProviders.provider, kind)).returning();
      return row;
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
      return row;
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
