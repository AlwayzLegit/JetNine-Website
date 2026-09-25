import { describe, expect, it } from "vitest";
import {
  parseToolArgs,
  toAnthropicMessages,
  toOpenAiMessages,
  toOpenAiTools,
  type HistoryItem,
} from "../src/llm/history.js";

const history: HistoryItem[] = [
  { role: "user", text: "I need a jet tomorrow" },
  { role: "assistant", text: "", toolCalls: [{ id: "t1", name: "save_lead", input: { urgency: "within_48h" } }] },
  { role: "tool_results", results: [{ id: "t1", name: "save_lead", output: "Saved. HOT LEAD" }] },
  { role: "assistant", text: "Let me connect you with our on-call broker." },
];

describe("history → Anthropic", () => {
  it("renders tool-only turns without an empty text block", () => {
    const msgs = toAnthropicMessages(history);
    expect(msgs).toHaveLength(4);
    const toolTurn = msgs[1];
    expect(toolTurn.role).toBe("assistant");
    expect(toolTurn.content).toEqual([{ type: "tool_use", id: "t1", name: "save_lead", input: { urgency: "within_48h" } }]);
    expect(msgs[2]).toEqual({ role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "Saved. HOT LEAD" }] });
  });
  it("marks tool errors", () => {
    const msgs = toAnthropicMessages([{ role: "tool_results", results: [{ id: "x", name: "n", output: "boom", isError: true }] }]);
    expect(msgs[0].content).toEqual([{ type: "tool_result", tool_use_id: "x", content: "boom", is_error: true }]);
  });
});

describe("history → OpenAI", () => {
  it("prepends the system prompt and stringifies tool arguments", () => {
    const msgs = toOpenAiMessages(history, "SYSTEM");
    expect(msgs[0]).toEqual({ role: "system", content: "SYSTEM" });
    expect(msgs[2]).toEqual({
      role: "assistant",
      content: null,
      tool_calls: [{ id: "t1", type: "function", function: { name: "save_lead", arguments: '{"urgency":"within_48h"}' } }],
    });
    expect(msgs[3]).toEqual({ role: "tool", tool_call_id: "t1", content: "Saved. HOT LEAD" });
    expect(msgs[4]).toEqual({ role: "assistant", content: "Let me connect you with our on-call broker." });
  });
  it("converts the tool catalogue", () => {
    const tools = toOpenAiTools([
      { name: "end_call", description: "d", input_schema: { type: "object", properties: {} } },
    ]);
    expect(tools[0]).toEqual({ type: "function", function: { name: "end_call", description: "d", parameters: { type: "object", properties: {} } } });
  });
  it("tolerates broken tool arguments", () => {
    expect(parseToolArgs('{"a":1}')).toEqual({ a: 1 });
    expect(parseToolArgs("{oops")).toEqual({});
    expect(parseToolArgs("")).toEqual({});
  });
});
