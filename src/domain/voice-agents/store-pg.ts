import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { voiceAgents, voiceAgentVersions } from "@/db/schema/voice-agents";
import { users } from "@/db/schema/users";
import type { VoiceAgentStore } from "./store";

// The Postgres side of the voice agent store (OPS-126): the queries that lived
// in src/domain/voice-agents/queries.ts and commands.ts, moved as they were,
// the three transactions included.

export function pgVoiceAgentStore(): VoiceAgentStore {
  return {
    async listAgents(includeArchived) {
      return db
        .select({
          id: voiceAgents.id,
          name: voiceAgents.name,
          description: voiceAgents.description,
          version: voiceAgents.version,
          isLive: voiceAgents.isLive,
          archivedAt: voiceAgents.archivedAt,
          updatedAt: voiceAgents.updatedAt,
        })
        .from(voiceAgents)
        .where(includeArchived ? undefined : isNull(voiceAgents.archivedAt))
        .orderBy(desc(voiceAgents.isLive), voiceAgents.name);
    },

    async getAgent(id) {
      const [r] = await db.select().from(voiceAgents).where(eq(voiceAgents.id, id)).limit(1);
      if (!r) return undefined;
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        version: r.version,
        isLive: r.isLive,
        archivedAt: r.archivedAt,
        updatedAt: r.updatedAt,
        config: r.config,
      };
    },

    async listVersions(agentId, limit) {
      return db
        .select({
          version: voiceAgentVersions.version,
          note: voiceAgentVersions.note,
          createdAt: voiceAgentVersions.createdAt,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(voiceAgentVersions)
        .leftJoin(users, eq(users.id, voiceAgentVersions.createdBy))
        .where(eq(voiceAgentVersions.agentId, agentId))
        .orderBy(desc(voiceAgentVersions.version))
        .limit(limit);
    },

    async versionConfig(agentId, version) {
      const [r] = await db
        .select({ config: voiceAgentVersions.config })
        .from(voiceAgentVersions)
        .where(and(eq(voiceAgentVersions.agentId, agentId), eq(voiceAgentVersions.version, version)))
        .limit(1);
      return r?.config;
    },

    async createAgent(row) {
      return db.transaction(async (tx) => {
        const [created] = await tx
          .insert(voiceAgents)
          .values({
            name: row.name,
            description: row.description,
            config: row.config,
            version: 1,
            createdBy: row.createdBy,
            updatedBy: row.createdBy,
          })
          .returning({ id: voiceAgents.id });
        await tx.insert(voiceAgentVersions).values({
          agentId: created.id,
          version: 1,
          config: row.config,
          note: row.note,
          createdBy: row.createdBy,
        });
        return created.id;
      });
    },

    async saveAgent(id, expectedVersion, patch, createdBy) {
      try {
        await db.transaction(async (tx) => {
          // Optimistic: another save in between bumps the version and this one fails cleanly.
          const updated = await tx
            .update(voiceAgents)
            .set({
              name: patch.name,
              description: patch.description,
              config: patch.config,
              version: patch.version,
              updatedBy: patch.updatedBy,
              updatedAt: patch.updatedAt,
            })
            .where(and(eq(voiceAgents.id, id), eq(voiceAgents.version, expectedVersion)))
            .returning({ id: voiceAgents.id });
          if (updated.length === 0) throw new Error("version-conflict");
          await tx.insert(voiceAgentVersions).values({
            agentId: id,
            version: patch.version,
            config: patch.config,
            note: patch.note,
            createdBy,
          });
        });
        return "ok";
      } catch (e) {
        if (e instanceof Error && e.message === "version-conflict") return "version-conflict";
        throw e;
      }
    },

    async makeLive(id, userId, now) {
      await db.transaction(async (tx) => {
        await tx
          .update(voiceAgents)
          .set({ isLive: false, updatedAt: now })
          .where(and(eq(voiceAgents.isLive, true), ne(voiceAgents.id, id)));
        await tx.update(voiceAgents).set({ isLive: true, updatedBy: userId, updatedAt: now }).where(eq(voiceAgents.id, id));
      });
    },

    async setArchived(id, archivedAt, userId, now) {
      await db
        .update(voiceAgents)
        .set({ archivedAt, updatedBy: userId, updatedAt: now })
        .where(eq(voiceAgents.id, id));
    },
  };
}
