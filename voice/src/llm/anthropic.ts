import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { PERSONA } from "./prompt.js";
import { TOOLS, runTool, type ToolContext } from "./tools.js";
import { toAnthropicMessages, type HistoryItem, type ToolCall, type ToolResult } from "./history.js";
import type { ProviderConfig } from "./providers.js";
import type { TurnCallbacks, TurnResult } from "./agent.js";

// Anthropic adapter: stream Claude's reply token-by-token, run any tools it
// asks for, loop until it stops. Manual streaming loop so an interrupt can
// abort the in-flight request.

const clients = new Map<string, Anthropic>();
function client(apiKey: string): Anthropic {
  let c = clients.get(apiKey);
  if (!c) {
    c = new Anthropic({ apiKey });
    clients.set(apiKey, c);
  }
  return c;
}

export async function runAnthropicTurn(
  p: ProviderConfig,
  history: HistoryItem[],
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

    const stream = client(p.apiKey).messages.stream(
      {
        model: p.model,
        max_tokens: config.llm.maxTokens,
        system,
        tools: TOOLS,
        messages: toAnthropicMessages(history),
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

    const toolCalls: ToolCall[] = message.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));
    history.push({ role: "assistant", text: textThisIteration, toolCalls: toolCalls.length ? toolCalls : undefined });

    if (message.stop_reason === "refusal") {
      const line = "I want to make sure this is handled properly. Let me connect you with our on-call broker.";
      callbacks.onText(line);
      spokenText += line;
      toolCtx.requestedEscalation = { reason: "other", summary: "Model refusal during call" };
      return { spokenText, aborted: false };
    }

    if (message.stop_reason !== "tool_use" || toolCalls.length === 0) {
      return { spokenText, aborted: false };
    }

    if (!textThisIteration.trim() && !spokenText.trim() && callbacks.onFiller) {
      const needsFiller = toolCalls.some((t) => t.name !== "escalate" && t.name !== "end_call");
      if (needsFiller) callbacks.onFiller();
    }

    const results: ToolResult[] = [];
    for (const use of toolCalls) {
      const { result, isError } = await runTool(use.name, use.input, toolCtx);
      results.push({ id: use.id, name: use.name, output: result, isError });
    }
    history.push({ role: "tool_results", results });

    if (toolCtx.requestedEscalation || toolCtx.requestedEnd) {
      return { spokenText, aborted: false };
    }
  }
  return { spokenText, aborted: false };
}
