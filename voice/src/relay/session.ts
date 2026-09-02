import type Anthropic from "@anthropic-ai/sdk";
import type { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import { config } from "../config.js";
import { runTurn } from "../llm/agent.js";
import { callContext } from "../llm/prompt.js";
import type { ToolContext } from "../llm/tools.js";
import {
  activeTrips,
  createCall,
  finalizeCall,
  lookupCaller,
  updateCall,
  type CallOutcome,
  type LeadRow,
  type TranscriptTurn,
  type TripRow,
} from "../db/queries.js";
import { leadSummarySms, sendAlertSms, startRecording } from "../escalation.js";
import type { HandoffData, InboundMessage, OutboundMessage, SetupMessage } from "./messages.js";

// One CallSession per ConversationRelay WebSocket. States:
//   connecting → active → (ending | escalating) → closed
// Twilio owns audio; we own the conversation. A dropped socket is a
// finished call — ConversationRelay does not reconnect.

type State = "connecting" | "active" | "ending" | "escalating" | "closed";

// Safety net under the model's own judgement: an explicit ask for a person
// transfers without waiting for the LLM to agree.
const HUMAN_ASK = /\b(?:speak|talk|connect(?:ed)?|get me|transfer(?: me)?)\s+(?:to|with)\s+(?:a |an |the )?(?:human|person|someone|agent|representative|broker|live person)\b|\b(?:real|actual|live) (?:person|human|agent)\b|\boperator\b|\bnot a (?:bot|robot|machine)\b/i;

const FILLER = "One moment.";

/** Never let a slow dependency hold up the conversation. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
const DB_TIMEOUT_MS = 2500;

export class CallSession {
  private state: State = "connecting";
  private callSid = "";
  private from = "";
  private to = "";
  private callId = "";
  private startedAt = new Date();
  private lead: LeadRow | null = null;
  private trips: TripRow[] = [];
  private messages: Anthropic.MessageParam[] = [];
  private transcript: TranscriptTurn[] = [];
  private contextBlock = "";
  private toolCtx!: ToolContext;
  /** Resolves once call row + caller lookup are done (or timed out). Turns wait on it. */
  private ready: Promise<void> = Promise.resolve();
  private inflight: AbortController | null = null;
  private turnChain: Promise<void> = Promise.resolve();
  private confusedTurns = 0;
  private escalationReason: string | null = null;
  private summary: string | null = null;
  private finalized = false;

  constructor(
    private readonly ws: WebSocket,
    private readonly log: FastifyBaseLogger,
  ) {}

  // ── Inbound dispatch ────────────────────────────────────────────────
  async handle(raw: string): Promise<void> {
    let msg: InboundMessage;
    try {
      msg = JSON.parse(raw) as InboundMessage;
    } catch {
      this.log.warn({ raw: raw.slice(0, 200) }, "relay: non-JSON frame");
      return;
    }
    if (config.logRelayMessages) this.log.info({ relayIn: msg }, "relay ←");

    switch (msg.type) {
      case "setup":
        await this.onSetup(msg);
        break;
      case "prompt":
        if (msg.last === false) return; // interim transcript; wait for the final
        this.enqueueTurn(msg.voicePrompt);
        break;
      case "interrupt":
        this.onInterrupt(msg.utteranceUntilInterrupt);
        break;
      case "dtmf":
        // v1: treat digits as speech-equivalent input so "press 0 for a person" style habits still work.
        if (msg.digit === "0") this.enqueueTurn("(caller pressed zero) I want to talk to a person.");
        break;
      case "error":
        this.log.error({ description: msg.description }, "relay: error from Twilio");
        break;
      default:
        break;
    }
  }

  // ── Setup ───────────────────────────────────────────────────────────
  private async onSetup(msg: SetupMessage) {
    this.callSid = msg.callSid;
    this.from = msg.from;
    this.to = msg.to;
    this.startedAt = new Date();
    this.log.info({ callSid: this.callSid, from: this.from }, "call: setup");

    // Usable defaults right away so an early utterance is never dropped.
    this.toolCtx = {
      callId: "",
      callerNumber: this.from,
      leadId: null,
      tripId: null,
      requestedEscalation: null,
      requestedEnd: null,
      outcomeHint: null,
    };
    this.contextBlock = this.buildContext();
    this.state = "active";

    // DB work runs alongside the greeting; the first turn awaits it, bounded.
    this.ready = this.prepareContext();

    // Recording cannot be started from ConversationRelay; use the REST API.
    startRecording(this.callSid).catch((err) =>
      this.log.warn({ err: err instanceof Error ? err.message : err }, "call: recording start failed"),
    );
  }

  private buildContext(): string {
    return callContext({
      from: this.from,
      to: this.to,
      lead: this.lead,
      activeTrips: this.trips,
      recordingEnabled: config.voice.recordingEnabled,
      nowIso: new Date().toISOString(),
    });
  }

  private async prepareContext(): Promise<void> {
    const t0 = Date.now();
    try {
      this.callId = await withTimeout(
        createCall({ callSid: this.callSid, from: this.from, to: this.to }),
        DB_TIMEOUT_MS,
        "createCall",
      );
      this.toolCtx.callId = this.callId;
    } catch (err) {
      this.log.error({ err: err instanceof Error ? err.message : err }, "call: could not create call row — continuing without persistence");
    }

    // Returning-caller match (simple SQL, no Conversation Memory in v1).
    if (this.from) {
      try {
        const found = await withTimeout(lookupCaller(this.from), DB_TIMEOUT_MS, "lookupCaller");
        this.lead = found.lead;
        this.trips = activeTrips(found.trips);
        this.toolCtx.leadId = this.lead?.id ?? null;
        if (this.lead && this.callId) {
          await withTimeout(updateCall(this.callId, { lead_id: this.lead.id, returning_caller: true }), DB_TIMEOUT_MS, "updateCall");
        }
      } catch (err) {
        this.log.warn({ err: err instanceof Error ? err.message : err }, "call: caller lookup skipped");
      }
    }
    this.contextBlock = this.buildContext();
    this.log.info({ callSid: this.callSid, ms: Date.now() - t0, returning: !!this.lead, activeTrips: this.trips.length }, "call: context ready");
  }

  // ── Turns ───────────────────────────────────────────────────────────
  private enqueueTurn(userText: string) {
    if (this.state !== "active") return;
    this.turnChain = this.turnChain.then(() => this.runTurn(userText)).catch((err) => {
      this.log.error({ err }, "turn: unhandled error");
    });
  }

  private async runTurn(userText: string) {
    if (this.state !== "active") return;
    const text = userText.trim();
    if (!text) return;
    await this.ready.catch(() => undefined);
    this.transcript.push({ role: "user", text, at: new Date().toISOString() });
    this.messages.push({ role: "user", content: text });

    // Hard rule: ask for a human → transfer on the first ask.
    if (HUMAN_ASK.test(text)) {
      const line = "Of course. Let me connect you with our on-call broker right now.";
      this.speak(line, true);
      this.transcript.push({ role: "assistant", text: line, at: new Date().toISOString() });
      this.messages.push({ role: "assistant", content: line });
      await this.escalate("caller_requested_human", `Caller asked for a person. Last said: "${text.slice(0, 160)}"`);
      return;
    }

    const controller = new AbortController();
    this.inflight = controller;
    let result;
    try {
      result = await runTurn(this.messages, this.contextBlock, this.toolCtx, {
        onText: (delta) => this.send({ type: "text", token: delta, last: false }),
        onFiller: () => this.send({ type: "text", token: FILLER + " ", last: false }),
      }, controller.signal);
    } catch (err) {
      this.log.error({ err }, "turn: model call failed");
      this.confusedTurns += 1;
      const line =
        this.confusedTurns >= 2
          ? "I am having trouble on my end. Let me connect you with our on-call broker."
          : "Sorry, I missed that. Could you say it once more?";
      this.speak(line, true);
      this.transcript.push({ role: "assistant", text: line, at: new Date().toISOString() });
      this.messages.push({ role: "assistant", content: line });
      if (this.confusedTurns >= 2) await this.escalate("agent_failing", "Two consecutive model failures");
      return;
    } finally {
      this.inflight = null;
    }

    if (result.aborted) {
      // The interrupt handler already logged the truncated turn.
      return;
    }
    this.confusedTurns = 0;
    if (result.spokenText.trim()) {
      this.transcript.push({ role: "assistant", text: result.spokenText, at: new Date().toISOString() });
    }

    if (this.toolCtx.requestedEscalation) {
      const { reason, summary } = this.toolCtx.requestedEscalation;
      this.toolCtx.requestedEscalation = null;
      await this.finishSpeaking(result.spokenText);
      await this.escalate(reason, summary);
      return;
    }
    if (this.toolCtx.requestedEnd) {
      this.summary = this.toolCtx.requestedEnd.summary;
      this.toolCtx.requestedEnd = null;
      await this.finishSpeaking(result.spokenText);
      await this.end("hangup");
      return;
    }
    // Normal end of turn: tell Twilio the utterance is complete.
    this.send({ type: "text", token: "", last: true });
  }

  private onInterrupt(utteranceUntilInterrupt: string) {
    if (this.inflight) {
      this.inflight.abort();
      this.inflight = null;
    }
    // Truncate the logged assistant turn to what the caller actually heard.
    const last = this.transcript[this.transcript.length - 1];
    if (last && last.role === "assistant") {
      last.text = utteranceUntilInterrupt || last.text;
      last.interrupted = true;
    } else {
      this.transcript.push({
        role: "assistant",
        text: utteranceUntilInterrupt,
        at: new Date().toISOString(),
        interrupted: true,
      });
    }
    // Keep the model's view consistent with what was heard.
    const lastMsg = this.messages[this.messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant") {
      this.messages[this.messages.length - 1] = {
        role: "assistant",
        content: (utteranceUntilInterrupt || "…") + " [interrupted by caller]",
      };
    } else if (utteranceUntilInterrupt) {
      this.messages.push({ role: "assistant", content: utteranceUntilInterrupt + " [interrupted by caller]" });
    }
  }

  // ── Speech helpers ──────────────────────────────────────────────────
  private speak(text: string, last: boolean) {
    this.send({ type: "text", token: text, last });
  }

  /** ConversationRelay ends the session immediately on `end`; give TTS time to finish the handoff line. */
  private async finishSpeaking(text: string) {
    this.send({ type: "text", token: "", last: true });
    const ms = Math.min(4500, Math.max(600, text.length * 55));
    await new Promise((r) => setTimeout(r, ms));
  }

  private send(msg: OutboundMessage) {
    if (this.ws.readyState !== this.ws.OPEN) return;
    if (config.logRelayMessages && !(msg.type === "text" && !msg.last)) this.log.info({ relayOut: msg }, "relay →");
    this.ws.send(JSON.stringify(msg));
  }

  // ── Endings ─────────────────────────────────────────────────────────
  private async escalate(reason: string, summary: string) {
    if (this.state === "escalating" || this.state === "closed") return;
    this.state = "escalating";
    this.escalationReason = reason;
    this.summary = summary;
    this.log.info({ callSid: this.callSid, reason }, "call: escalating");
    // Persist before the leg ends so the broker screen has the context.
    await this.finalize("escalated");
    const handoff: HandoffData = {
      action: "escalate",
      reason,
      callSid: this.callSid,
      leadId: this.toolCtx.leadId,
      summary,
    };
    this.send({ type: "end", handoffData: JSON.stringify(handoff) });
  }

  private async end(action: "hangup") {
    if (this.state === "closed") return;
    this.state = "ending";
    const outcome: CallOutcome = this.toolCtx.outcomeHint ?? "other";
    await this.finalize(outcome);
    const handoff: HandoffData = { action, callSid: this.callSid, leadId: this.toolCtx.leadId, summary: this.summary ?? undefined };
    this.send({ type: "end", handoffData: JSON.stringify(handoff) });
  }

  /** Socket closed by Twilio (caller hung up, or transfer completed). */
  async onClose() {
    if (this.inflight) this.inflight.abort();
    if (this.finalized) {
      this.state = "closed";
      return;
    }
    const outcome: CallOutcome =
      this.toolCtx?.outcomeHint ?? (this.transcript.some((t) => t.role === "user") ? "other" : "abandoned");
    await this.finalize(outcome);
    this.state = "closed";
  }

  private async finalize(outcome: CallOutcome) {
    if (this.finalized || !this.callId) {
      this.finalized = true;
      return;
    }
    this.finalized = true;
    try {
      await finalizeCall({
        callId: this.callId,
        outcome,
        transcript: this.transcript,
        leadId: this.toolCtx?.leadId ?? null,
        summary: this.summary,
        escalationReason: this.escalationReason,
        startedAt: this.startedAt,
      });
    } catch (err) {
      this.log.error({ err }, "call: finalize failed");
    }
    // Every completed quote-request call alerts the desk, escalated or not.
    if (outcome === "lead" || outcome === "escalated") {
      await sendAlertSms(
        leadSummarySms({
          from: this.from,
          summary: this.summary,
          transcript: this.transcript,
          escalated: outcome === "escalated",
          escalationReason: this.escalationReason,
        }),
        this.log,
      );
    }
  }
}
