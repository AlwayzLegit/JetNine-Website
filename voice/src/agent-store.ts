import { config } from "./config.js";
import { getDb } from "./db/client.js";
import { DEFAULT_AGENT_CONFIG, parseAgentConfig, type VoiceAgentConfig } from "./agent-config.js";

// The live voice agent (Settings › Voice agent › Agents on the site, table
// voice_agents). Cached for 30 seconds so a save on the site reaches the
// next call quickly without a database read on every webhook; the last good
// answer is kept if Supabase does not answer, so a database blip never
// silences the phone. With no live agent (or before migration 0054), calls
// use the built-in defaults with the voice settings from the environment.

export type LoadedAgent = { id: string | null; name: string; version: number; config: VoiceAgentConfig };

const CACHE_MS = 30_000;
const live: { at: number; agent: LoadedAgent | null } = { at: 0, agent: null };
const byId = new Map<string, { at: number; agent: LoadedAgent }>();

/** Built-in agent: the defaults, with TTS/STT from the environment as before. */
export function builtInAgent(): LoadedAgent {
  const c = structuredClone(DEFAULT_AGENT_CONFIG);
  c.voice.provider = (config.voice.ttsProvider as VoiceAgentConfig["voice"]["provider"]) || c.voice.provider;
  c.voice.voiceId = config.voice.ttsVoice;
  c.voice.model = config.voice.ttsVoice ? config.voice.ttsModel : c.voice.model;
  c.speech.provider = (config.voice.sttProvider as VoiceAgentConfig["speech"]["provider"]) || c.speech.provider;
  c.speech.model = config.voice.sttModel || c.speech.model;
  c.profile.language = config.voice.language || c.profile.language;
  return { id: null, name: "Built-in defaults", version: 0, config: c };
}

type Row = { id: string; name: string; version: number; config: unknown };

function toAgent(r: Row): LoadedAgent {
  return { id: r.id, name: r.name, version: r.version, config: parseAgentConfig(r.config) };
}

export async function liveAgent(): Promise<LoadedAgent> {
  if (live.agent && Date.now() - live.at < CACHE_MS) return live.agent;
  try {
    const { data, error } = await getDb()
      .from("voice_agents")
      .select("id, name, version, config")
      .eq("is_live", true)
      .is("archived_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const agent = data ? toAgent(data as Row) : builtInAgent();
    live.at = Date.now();
    live.agent = agent;
    if (agent.id) byId.set(agent.id, { at: Date.now(), agent });
    return agent;
  } catch {
    // Missing table or no database: keep the last good answer, else defaults.
    return live.agent ?? builtInAgent();
  }
}

/** The agent a call was started with (passed to the relay as a <Parameter>). */
export async function agentById(id: string | undefined): Promise<LoadedAgent> {
  if (!id) return liveAgent();
  const hit = byId.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.agent;
  try {
    const { data, error } = await getDb().from("voice_agents").select("id, name, version, config").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return liveAgent();
    const agent = toAgent(data as Row);
    byId.set(id, { at: Date.now(), agent });
    return agent;
  } catch {
    return hit?.agent ?? liveAgent();
  }
}
