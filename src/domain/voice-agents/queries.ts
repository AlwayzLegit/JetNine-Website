import { isUuid } from "@/domain/common";
import { parseAgentConfig, type VoiceAgentConfig } from "@/lib/voice-agent-config";
import { voiceAgentStore } from "./store";

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
    const rows = await voiceAgentStore().listAgents(opts.includeArchived ?? false);
    return {
      agents: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        version: r.version,
        isLive: r.isLive,
        updatedAt: r.updatedAt,
        archived: r.archivedAt !== null,
      })),
      tableMissing: false,
    };
  } catch (e) {
    console.error("[voice-agents] list failed", e);
    return { agents: [], tableMissing: true };
  }
}

export async function getAgent(id: string): Promise<AgentDetail | null> {
  if (!isUuid(id)) return null;
  const r = await voiceAgentStore().getAgent(id);
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
  const rows = await voiceAgentStore().listVersions(agentId, limit);
  return rows.map((r) => ({
    version: r.version,
    note: r.note,
    createdAt: r.createdAt,
    by: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email || null,
  }));
}

export async function getVersion(agentId: string, version: number): Promise<VoiceAgentConfig | null> {
  if (!isUuid(agentId)) return null;
  const config = await voiceAgentStore().versionConfig(agentId, version);
  return config === undefined ? null : parseAgentConfig(config);
}
