import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages";

// Provider-neutral conversation history. The session owns one of these per
// call; each adapter renders it into its vendor's wire format on every
// turn. Keeping the neutral form as the source of truth is what lets a
// turn fall back from one vendor to the other mid-call without losing the
// conversation so far.

export type ToolCall = { id: string; name: string; input: unknown };
export type ToolResult = { id: string; name: string; output: string; isError?: boolean };

export type HistoryItem =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls?: ToolCall[] }
  | { role: "tool_results"; results: ToolResult[] };

// ── Anthropic ───────────────────────────────────────────────────────────

export function toAnthropicMessages(history: HistoryItem[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const item of history) {
    if (item.role === "user") {
      out.push({ role: "user", content: item.text });
    } else if (item.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];
      // Anthropic rejects empty text blocks; a tool-only turn has no text.
      if (item.text.trim()) content.push({ type: "text", text: item.text });
      for (const c of item.toolCalls ?? []) {
        content.push({ type: "tool_use", id: c.id, name: c.name, input: c.input ?? {} });
      }
      if (content.length === 0) content.push({ type: "text", text: "…" });
      out.push({ role: "assistant", content });
    } else {
      out.push({
        role: "user",
        content: item.results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.id,
          content: r.output,
          ...(r.isError ? { is_error: true } : {}),
        })),
      });
    }
  }
  return out;
}

// ── OpenAI (Chat Completions) ───────────────────────────────────────────

export function toOpenAiMessages(
  history: HistoryItem[],
  system: string,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: system }];
  for (const item of history) {
    if (item.role === "user") {
      out.push({ role: "user", content: item.text });
    } else if (item.role === "assistant") {
      const calls = item.toolCalls ?? [];
      out.push({
        role: "assistant",
        content: item.text.trim() ? item.text : null,
        ...(calls.length
          ? {
              tool_calls: calls.map((c) => ({
                id: c.id,
                type: "function" as const,
                function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
              })),
            }
          : {}),
      });
    } else {
      for (const r of item.results) {
        out.push({ role: "tool", tool_call_id: r.id, content: r.output });
      }
    }
  }
  return out;
}

export function toOpenAiTools(tools: AnthropicTool[]): OpenAI.Chat.Completions.ChatCompletionFunctionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as Record<string, unknown>,
    },
  }));
}

/** Tool arguments arrive as a JSON string from OpenAI; a broken one becomes an empty object rather than a crash. */
export function parseToolArgs(raw: string): unknown {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}
