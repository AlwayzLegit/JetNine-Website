import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { voiceAgents, voiceAgentVersions } from "@/db/schema/voice-agents";
import { users } from "@/db/schema/users";
import { isUuid } from "@/domain/common";
import { parseAgentConfig, type VoiceAgentConfig } from "@/lib/voice-agent-config";

/** Settings › Voice agent: the agents, one agent, its saved versions. */

export type AgentSummary = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isLive: boolean;
  archived: boolean;
  updatedAt: Date;
};

export type AgentDetail = AgentSummary & { config: VoiceAgentConfig };

export type AgentVersion = { version: number; note: string | null; createdAt: Date; by: string | null };

/** Never throws: a missing table (migration 0054 not applied) reads as no agents. */
export async function listAgents(opts: { includeArchived?: boolean } = {}): Promise<{ agents: AgentSummary[]; tableMissing: boolean }> {
  try {
    const rows = await db
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
      .where(opts.includeArchived ? undefined : isNull(voiceAgents.archivedAt))
      .orderBy(desc(voiceAgents.isLive), voiceAgents.name);
    return {
      agents: rows.map((r) => ({ ...r, archived: r.archivedAt !== null })),
      tableMissing: false,
    };
  } catch (e) {
    console.error("[voice-agents] list failed", e);
    return { agents: [], tableMissing: true };
  }
}

export async function getAgent(id: string): Promise<AgentDetail | null> {
  if (!isUuid(id)) return null;
  const [r] = await db.select().from(voiceAgents).where(eq(voiceAgents.id, id)).limit(1);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    version: r.version,
    isLive: r.isLive,
    archived: r.archivedAt !== null,
    updatedAt: r.updatedAt,
    config: parseAgentConfig(r.config),
  };
}

export async function listVersions(agentId: string, limit = 30): Promise<AgentVersion[]> {
  if (!isUuid(agentId)) return [];
  const rows = await db
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
  return rows.map((r) => ({
    version: r.version,
    note: r.note,
    createdAt: r.createdAt,
    by: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email || null,
  }));
}

export async function getVersion(agentId: string, version: number): Promise<VoiceAgentConfig | null> {
  if (!isUuid(agentId)) return null;
  const [r] = await db
    .select({ config: voiceAgentVersions.config })
    .from(voiceAgentVersions)
    .where(and(eq(voiceAgentVersions.agentId, agentId), eq(voiceAgentVersions.version, version)))
    .limit(1);
  return r ? parseAgentConfig(r.config) : null;
}
