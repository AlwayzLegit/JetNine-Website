import OpenAI from "openai";
import { config } from "../config.js";
import { PERSONA } from "./prompt.js";
import { TOOLS, runTool, type ToolContext } from "./tools.js";
import {
  parseToolArgs,
  toOpenAiMessages,
  toOpenAiTools,
  type HistoryItem,
  type ToolCall,
  type ToolResult,
} from "./history.js";
import type { ProviderConfig } from "./providers.js";
import type { TurnCallbacks, TurnResult } from "./agent.js";

// OpenAI adapter over Chat Completions with streaming and function tools.
// Same contract as the Anthropic adapter: speak deltas as they arrive, run
// tool calls, loop until the model stops, honour the abort signal.

const clients = new Map<string, OpenAI>();
function client(apiKey: string): OpenAI {
  let c = clients.get(apiKey);
  if (!c) {
    c = new OpenAI({ apiKey });
    clients.set(apiKey, c);
  }
  return c;
}

const OPENAI_TOOLS = toOpenAiTools(TOOLS);

type PendingCall = { id: string; name: string; args: string };

export async function runOpenAiTurn(
  p: ProviderConfig,
  history: HistoryItem[],
  callContextBlock: string,
  toolCtx: ToolContext,
  callbacks: TurnCallbacks,
  signal: AbortSignal,
): Promise<TurnResult> {
  let spokenText = "";
  const system = `${PERSONA}\n\n${callContextBlock}`;

  for (let iteration = 0; iteration < 6; iteration++) {
    if (signal.aborted) return { spokenText, aborted: true };

    let textThisIteration = "";
    const pending = new Map<number, PendingCall>();
    let finish: string | null = null;

    try {
      const stream = await client(p.apiKey).chat.completions.create(
        {
          model: p.model,
          messages: toOpenAiMessages(history, system),
          tools: OPENAI_TOOLS,
          stream: true,
          max_completion_tokens: config.llm.maxTokens,
        },
        { signal },
      );
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        const delta = choice.delta;
        if (delta?.content) {
          textThisIteration += delta.content;
          spokenText += delta.content;
          callbacks.onText(delta.content);
        }
        for (const tc of delta?.tool_calls ?? []) {
          const slot = pending.get(tc.index) ?? { id: "", name: "", args: "" };
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name += tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
          pending.set(tc.index, slot);
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
    } catch (err) {
      if (err instanceof OpenAI.APIUserAbortError || signal.aborted) {
        return { spokenText, aborted: true };
      }
      throw err;
    }

    const toolCalls: ToolCall[] = [...pending.values()]
      .filter((c) => c.name)
      .map((c, i) => ({ id: c.id || `call_${iteration}_${i}`, name: c.name, input: parseToolArgs(c.args) }));
    history.push({ role: "assistant", text: textThisIteration, toolCalls: toolCalls.length ? toolCalls : undefined });

    if (finish === "content_filter") {
      const line = "I want to make sure this is handled properly. Let me connect you with our on-call broker.";
      callbacks.onText(line);
      spokenText += line;
      toolCtx.requestedEscalation = { reason: "other", summary: "Model refusal during call" };
      return { spokenText, aborted: false };
    }

    if (toolCalls.length === 0) {
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
