import type { FastifyBaseLogger } from "fastify";
import type { HistoryItem } from "./history.js";
import type { ToolContext } from "./tools.js";
import { describeRouting, resolveRouting, type ProviderConfig } from "./providers.js";
import { runAnthropicTurn } from "./anthropic.js";
import { runOpenAiTurn } from "./openai.js";

// One conversational turn, routed to whichever vendor the admin chose.
// The primary provider runs the turn; if it fails before the caller has
// heard a word, the same turn is retried once on the fallback. Once
// something has been spoken there is no retry (it would repeat itself),
// so the error surfaces to the session, which already handles it.

export type TurnCallbacks = {
  /** A text delta to speak now. */
  onText: (delta: string) => void;
  /** Spoken filler before a tool call when nothing has been said yet. */
  onFiller?: () => void;
};

export type TurnResult = {
  /** Full assistant text produced this turn (may span several tool iterations). */
  spokenText: string;
  aborted: boolean;
  /** Which provider produced the turn, for the call log. */
  provider?: string;
};

function runWith(
  p: ProviderConfig,
  history: HistoryItem[],
  contextBlock: string,
  toolCtx: ToolContext,
  callbacks: TurnCallbacks,
  signal: AbortSignal,
): Promise<TurnResult> {
  return p.provider === "openai"
    ? runOpenAiTurn(p, history, contextBlock, toolCtx, callbacks, signal)
    : runAnthropicTurn(p, history, contextBlock, toolCtx, callbacks, signal);
}

export async function runTurn(
  history: HistoryItem[],
  callContextBlock: string,
  toolCtx: ToolContext,
  callbacks: TurnCallbacks,
  signal: AbortSignal,
  log?: FastifyBaseLogger,
): Promise<TurnResult> {
  const routing = await resolveRouting();
  if (!routing.primary) {
    throw new Error(`No LLM provider configured (${routing.note})`);
  }

  let spoke = false;
  const watched: TurnCallbacks = {
    onText: (d) => {
      if (d) spoke = true;
      callbacks.onText(d);
    },
    onFiller: callbacks.onFiller
      ? () => {
          spoke = true;
          callbacks.onFiller?.();
        }
      : undefined,
  };

  const historyLen = history.length;
  try {
    const r = await runWith(routing.primary, history, callContextBlock, toolCtx, watched, signal);
    return { ...r, provider: `${routing.primary.provider}/${routing.primary.model}` };
  } catch (err) {
    if (signal.aborted) return { spokenText: "", aborted: true };
    if (!routing.fallback || spoke) throw err;
    log?.warn(
      { err: err instanceof Error ? err.message : String(err), ...describeRouting(routing) },
      "turn: primary provider failed before speaking; retrying on fallback",
    );
    // Undo anything the failed attempt appended so the fallback sees the
    // turn exactly as the primary did.
    history.length = historyLen;
    const r = await runWith(routing.fallback, history, callContextBlock, toolCtx, watched, signal);
    return { ...r, provider: `${routing.fallback.provider}/${routing.fallback.model} (fallback)` };
  }
}
