import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "@/db/d1/schema/users";
import { voiceAgents, voiceAgentVersions } from "@/db/d1/schema/voice-agents";
import type { VoiceAgentStore } from "./store";

// The D1 (SQLite) side of the voice agent store (OPS-126). Same methods and
// the same results as store-pg.ts, on the D1 twin tables (src/db/d1/schema,
// OPS-100). A change that spans two statements is one db.batch(), which D1
// runs atomically: all of it or none of it. The client is passed in so a test
// can hand it a real SQLite.

// The D1 client from d1Db(). A test casts a sqlite-proxy over node:sqlite to it.
type D1Client = DrizzleD1Database;

export function d1VoiceAgentStore(db: D1Client): VoiceAgentStore {
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
      // The id is made here, so the version row can name it in the same batch.
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(voiceAgents).values({
          id,
          name: row.name,
          description: row.description,
          config: row.config,
          version: 1,
          createdBy: row.createdBy,
          updatedBy: row.createdBy,
        }),
        db.insert(voiceAgentVersions).values({
          agentId: id,
          version: 1,
          config: row.config,
          note: row.note,
          createdBy: row.createdBy,
        }),
      ]);
      return id;
    },

    async saveAgent(id, expectedVersion, patch, createdBy) {
      // One batch: the update only matches while the agent still has the expected
      // version, and the version row is written only when that update happened
      // (the agent now carries the new version and no row for it exists yet). A
      // stale save therefore changes nothing. The unique key (agent_id, version)
      // is the backstop for a race that gets past both.
      const [updated] = await db.batch([
        db
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
          .returning({ id: voiceAgents.id }),
        db.run(sql`
          insert into voice_agent_versions (id, agent_id, version, config, note, created_by, created_at)
          select ${crypto.randomUUID()}, ${id}, ${patch.version}, ${JSON.stringify(patch.config)}, ${patch.note}, ${createdBy}, ${patch.updatedAt.getTime()}
          where exists (select 1 from voice_agents where id = ${id} and version = ${patch.version})
            and not exists (select 1 from voice_agent_versions where agent_id = ${id} and version = ${patch.version})
        `),
      ]);
      return updated.length === 0 ? "version-conflict" : "ok";
    },

    async makeLive(id, userId, now) {
      // Clear the others first, so the partial unique index never sees two live rows.
      await db.batch([
        db
          .update(voiceAgents)
          .set({ isLive: false, updatedAt: now })
          .where(and(eq(voiceAgents.isLive, true), ne(voiceAgents.id, id))),
        db.update(voiceAgents).set({ isLive: true, updatedBy: userId, updatedAt: now }).where(eq(voiceAgents.id, id)),
      ]);
    },

    async setArchived(id, archivedAt, userId, now) {
      await db
        .update(voiceAgents)
        .set({ archivedAt, updatedBy: userId, updatedAt: now })
        .where(eq(voiceAgents.id, id));
    },
  };
}
