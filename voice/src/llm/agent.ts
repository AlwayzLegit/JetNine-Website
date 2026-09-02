import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { PERSONA } from "./prompt.js";
import { TOOLS, runTool, type ToolContext } from "./tools.js";

// One conversational turn: stream Claude's reply token-by-token to the
// caller, run any tools it asks for, and loop until it stops. Streaming
// manual loop (non-beta) so an interrupt can abort the in-flight request.

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: config.anthropic.apiKey || undefined });
  return client;
}

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
};

export async function runTurn(
  messages: Anthropic.MessageParam[],
  callContextBlock: string,
  toolCtx: ToolContext,
  callbacks: TurnCallbacks,
  signal: AbortSignal,
): Promise<TurnResult> {
  let spokenText = "";
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: PERSONA, cache_control: { type: "ephemeral" } },
    { type: "text", text: callContextBlock },
  ];

  for (let iteration = 0; iteration < 6; iteration++) {
    if (signal.aborted) return { spokenText, aborted: true };

    const stream = getClient().messages.stream(
      {
        model: config.anthropic.model,
        max_tokens: config.anthropic.maxTokens,
        system,
        tools: TOOLS,
        messages,
        ...(config.anthropic.thinking === "adaptive"
          ? { thinking: { type: "adaptive" as const }, output_config: { effort: "low" as const } }
          : { thinking: { type: "disabled" as const } }),
      },
      { signal },
    );

    let textThisIteration = "";
    stream.on("text", (delta) => {
      textThisIteration += delta;
      spokenText += delta;
      callbacks.onText(delta);
    });

    let message: Anthropic.Message;
    try {
      message = await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.APIUserAbortError || signal.aborted) {
        return { spokenText, aborted: true };
      }
      throw err;
    }

    messages.push({ role: "assistant", content: message.content });

    if (message.stop_reason === "refusal") {
      const line = "I want to make sure this is handled properly. Let me connect you with our on-call broker.";
      callbacks.onText(line);
      spokenText += line;
      toolCtx.requestedEscalation = { reason: "other", summary: "Model refusal during call" };
      return { spokenText, aborted: false };
    }

    const toolUses = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
      return { spokenText, aborted: false };
    }

    if (!textThisIteration.trim() && !spokenText.trim() && callbacks.onFiller) {
      // Nothing spoken yet and we are about to hit the network — cover the gap.
      const needsFiller = toolUses.some((t) => t.name !== "escalate" && t.name !== "end_call");
      if (needsFiller) callbacks.onFiller();
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const { result, isError } = await runTool(use.name, use.input, toolCtx);
      results.push({ type: "tool_result", tool_use_id: use.id, content: result, ...(isError ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });

    // Terminal tools: the session takes over (transfer / hang up).
    if (toolCtx.requestedEscalation || toolCtx.requestedEnd) {
      return { spokenText, aborted: false };
    }
  }
  return { spokenText, aborted: false };
}
