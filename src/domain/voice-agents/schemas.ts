import { z } from "zod";
import { VoiceAgentConfigSchema } from "@/lib/voice-agent-config";

/**
 * Inputs for the voice-agent operations (Settings › Voice agent). Kept free
 * of `server-only` imports: scripts/check-api.mts loads the registry under
 * tsx.
 */

const name = z.string().trim().min(1, { error: "Give the agent a name" }).max(80);
const description = z.string().trim().max(300).optional();

export const CreateAgentInput = z.object({
  name,
  description,
  /** Start from a copy of this agent's settings; otherwise the defaults. */
  fromAgentId: z.uuid().optional(),
});
export type CreateAgentInput = z.infer<typeof CreateAgentInput>;

export const SaveAgentInput = z.object({
  id: z.uuid(),
  name,
  description,
  config: VoiceAgentConfigSchema,
  /** One line for the version list: what changed. */
  note: z.string().trim().max(200).optional(),
});
export type SaveAgentInput = z.infer<typeof SaveAgentInput>;

export const AgentIdInput = z.object({ id: z.uuid() });
export type AgentIdInput = z.infer<typeof AgentIdInput>;

export const RestoreVersionInput = z.object({ id: z.uuid(), version: z.number().int().min(1) });
export type RestoreVersionInput = z.infer<typeof RestoreVersionInput>;

export const ArchiveAgentInput = AgentIdInput.extend({ archived: z.boolean() });
export type ArchiveAgentInput = z.infer<typeof ArchiveAgentInput>;
