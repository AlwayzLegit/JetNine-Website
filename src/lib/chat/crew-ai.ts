// The service binding to the Crew's shared AI Worker, crew-ai (OPS-236, OPS-241).
// The site holds no API key: the key and the daily budget live in that Worker.
// wrangler.jsonc binds CREW_AI to the entry point JetNineChat (production) or
// JetNineStagingChat (staging).
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AiResult, CallAi } from "./handle";

export type AiStatus = { enabled: boolean; budgetUsd: number; spentTodayUsd: number };

type Binding = {
  chat(input: unknown): Promise<AiResult>;
  status(): Promise<AiStatus>;
};

function binding(): Binding | null {
  try {
    const env = getCloudflareContext().env as { CREW_AI?: Binding };
    return env.CREW_AI ?? null;
  } catch {
    return null; // not inside a Cloudflare request
  }
}

/** The chat call, or null when the binding is missing (the caller then shows the fallback). */
export function crewAiChat(): CallAi | null {
  const b = binding();
  return b ? (input) => b.chat(input) : null;
}

/** crew-ai's status, or null when the binding is missing or the call fails. */
export async function crewAiStatus(): Promise<AiStatus | null> {
  const b = binding();
  if (!b) return null;
  try {
    const s = await b.status();
    return typeof s?.enabled === "boolean" ? s : null;
  } catch {
    return null;
  }
}
