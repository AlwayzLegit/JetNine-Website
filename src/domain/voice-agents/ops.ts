import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import { configWords } from "@/lib/voice-agent-config";
import {
  createAgent,
  loadAgent,
  loadCreate,
  makeLive,
  restoreVersion,
  saveAgent,
  setArchived,
  type AgentState,
  type CreateState,
} from "./commands";
import { AgentIdInput, ArchiveAgentInput, CreateAgentInput, RestoreVersionInput, SaveAgentInput } from "./schemas";

/**
 * Settings › Voice agent › Agents. Changing what answers the phone is a
 * `settings` matter: owners only, and a supervised key's change waits for
 * an owner.
 */

export const VOICE_PATH = "/admin/settings/voice";
const agentPath = (id: string) => `${VOICE_PATH}/agents/${id}`;

export const createAgentOp = defineOp<CreateAgentInput, CreateState>({
  id: "voiceAgent.create",
  scope: "settings",
  schema: CreateAgentInput,
  load: loadCreate,
  risk: () => "settings",
  summary: (input, state) => `Create voice agent “${input.name}”${state.sourceName ? ` from ${state.sourceName}` : ""}`,
  subject: () => ({ type: "system", id: null, code: "voice_agent" }),
  run: createAgent,
  revalidate: () => [VOICE_PATH],
});

export const saveAgentOp = defineOp<SaveAgentInput, AgentState>({
  id: "voiceAgent.save",
  scope: "settings",
  schema: SaveAgentInput,
  load: loadAgent,
  risk: () => "settings",
  summary: (input, state) => `Save voice agent “${input.name}”${state.agent.isLive ? " (live)" : ""}`,
  preview: (input, state) => {
    const before = configWords(state.agent.config);
    const after = configWords(input.config);
    return before === after ? (input.note ?? null) : `${before} → ${after}`;
  },
  subject: (input) => ({ type: "system", id: input.id, code: "voice_agent" }),
  run: saveAgent,
  revalidate: (input) => [VOICE_PATH, agentPath(input.id)],
});

export const makeLiveOp = defineOp<AgentIdInput, AgentState>({
  id: "voiceAgent.makeLive",
  scope: "settings",
  schema: AgentIdInput,
  load: loadAgent,
  risk: () => "settings",
  summary: (_input, state) => `Make “${state.agent.name}” the agent that answers the phone`,
  subject: (input) => ({ type: "system", id: input.id, code: "voice_agent" }),
  run: makeLive,
  revalidate: (input) => [VOICE_PATH, agentPath(input.id)],
});

export const archiveAgentOp = defineOp<ArchiveAgentInput, AgentState>({
  id: "voiceAgent.archive",
  scope: "settings",
  schema: ArchiveAgentInput,
  load: loadAgent,
  risk: () => "settings",
  summary: (input, state) => `${input.archived ? "Archive" : "Restore"} voice agent “${state.agent.name}”`,
  subject: (input) => ({ type: "system", id: input.id, code: "voice_agent" }),
  run: setArchived,
  revalidate: (input) => [VOICE_PATH, agentPath(input.id)],
});

export const restoreVersionOp = defineOp<RestoreVersionInput, AgentState>({
  id: "voiceAgent.restoreVersion",
  scope: "settings",
  schema: RestoreVersionInput,
  load: loadAgent,
  risk: () => "settings",
  summary: (input, state) => `Restore “${state.agent.name}” to version ${input.version}`,
  subject: (input) => ({ type: "system", id: input.id, code: "voice_agent" }),
  run: restoreVersion,
  revalidate: (input) => [VOICE_PATH, agentPath(input.id)],
});

export const VOICE_AGENT_OPS: AnyOp[] = [createAgentOp, saveAgentOp, makeLiveOp, archiveAgentOp, restoreVersionOp];
