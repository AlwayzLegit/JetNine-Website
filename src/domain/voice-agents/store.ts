import { d1Db, dbTarget } from "@/db";
import { d1VoiceAgentStore } from "./store-d1";
import { pgVoiceAgentStore } from "./store-pg";

// The voice agent configs' one door to the database (OPS-126): voice_agents
// and voice_agent_versions (Settings, Voice agent). Every query on those two
// tables goes through a VoiceAgentStore. There is one adapter per database,
// chosen per request by dbTarget(): Postgres until the move, D1 where
// DB_TARGET is "d1" (staging first; the code refuses "d1" in production, see
// src/db/target.mjs). The voice service in voice/ is its own Worker and keeps
// reading Postgres; it is not part of this store.

export type AgentSummaryRow = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isLive: boolean;
  archivedAt: Date | null;
  updatedAt: Date;
};

/** The agent with its stored config, which the caller parses. */
export type AgentRow = AgentSummaryRow & { config: unknown };

export type VersionRow = {
  version: number;
  note: string | null;
  createdAt: Date;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

export type NewAgent = {
  name: string;
  description: string | null;
  config: unknown;
  createdBy: string | null;
  /** The note on version 1. */
  note: string;
};

export type AgentPatch = {
  name: string;
  description: string | null;
  config: unknown;
  /** The new version number: the expected one plus 1. */
  version: number;
  updatedBy: string | null;
  updatedAt: Date;
  /** The note on the new version row. */
  note: string | null;
};

export interface VoiceAgentStore {
  /** Live agent first, then by name. */
  listAgents(includeArchived: boolean): Promise<AgentSummaryRow[]>;
  getAgent(id: string): Promise<AgentRow | undefined>;
  /** Newest first, with the author's name parts. */
  listVersions(agentId: string, limit: number): Promise<VersionRow[]>;
  /** The config stored for one version, or undefined. */
  versionConfig(agentId: string, version: number): Promise<unknown | undefined>;
  /** The agent and its version 1, written together or not at all. Returns the new id. */
  createAgent(row: NewAgent): Promise<string>;
  /**
   * Write the new version of the agent and its version row together, only when
   * the agent still has `expectedVersion`. A second save of the same version
   * returns "version-conflict" and changes nothing.
   */
  saveAgent(id: string, expectedVersion: number, patch: AgentPatch, createdBy: string | null): Promise<"ok" | "version-conflict">;
  /** Clear the live flag on every other agent, then set it on this one, together. */
  makeLive(id: string, userId: string | null, now: Date): Promise<void>;
  /** Set (`archivedAt` a Date) or clear (null) the archived mark. */
  setArchived(id: string, archivedAt: Date | null, userId: string | null, now: Date): Promise<void>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function voiceAgentStore(): VoiceAgentStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1VoiceAgentStore(client);
  }
  return pgVoiceAgentStore();
}
