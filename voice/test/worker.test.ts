import { exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { twilioSignature } from "../src/twilio.js";
import { config } from "../src/config.js";

// The Worker end to end in workerd. wrangler.jsonc sets NODE_ENV=production,
// so signatures are enforced; vitest.config.ts sets the test auth token and
// PUBLIC_HOST=voice.example.com. No database or LLM key: not call-ready.
const worker = exports.default;
const TOKEN = "test-auth-token";

async function signedPost(path: string, params: Record<string, string>) {
  const signature = await twilioSignature(TOKEN, `https://voice.example.com${path}`, params);
  return worker.fetch(`https://voice.example.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature },
    body: new URLSearchParams(params),
  });
}

describe("worker routes", () => {
  // The first request loads the Worker's SDK module graph, which can take
  // tens of seconds on a busy machine; keep that out of any one test.
  beforeAll(async () => {
    await worker.fetch("https://voice.example.com/health");
  }, 180_000);

  it("GET /health reports missing configuration with 503", async () => {
    const res = await worker.fetch("https://voice.example.com/health");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; service: string; missingEnv: string[] };
    expect(body.ok).toBe(false);
    expect(body.service).toBe("jetnine-voice");
    expect(body.missingEnv).toContain("ESCALATION_PHONE");
  });

  it("rejects an unsigned webhook", async () => {
    const res = await worker.fetch("https://voice.example.com/twiml", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "CallSid=CA00000000000000000000000000000000",
    });
    expect(res.status).toBe(403);
  });

  it("answers a signed /twiml with the unavailable message when not configured", async () => {
    const res = await signedPost("/twiml", { CallSid: "CA00000000000000000000000000000000", From: "+15550001111" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/xml");
    expect(await res.text()).toMatch(/temporarily unavailable.*<Hangup\/>/s);
  });

  it("signed query strings are part of the signed URL", async () => {
    const res = await signedPost("/escalation/result?callSid=CA1", { DialCallStatus: "completed", DialBridged: "true" });
    expect(await res.text()).toContain("<Hangup/>");
  });

  it("broker screen: 1 bridges, anything else hangs up", async () => {
    expect(await (await signedPost("/escalation/screen", {})).text()).toContain("Press 1");
    expect(await (await signedPost("/escalation/screen/answer", { Digits: "1" })).text()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>',
    );
    expect(await (await signedPost("/escalation/screen/answer", { Digits: "2" })).text()).toContain("<Hangup/>");
  });

  it("relay/action hangs up a normal end, and transfers on a failed relay", async () => {
    const sid = "CA11111111111111111111111111111111";
    const hangup = await signedPost("/relay/action", { CallSid: sid, SessionStatus: "ended", HandoffData: JSON.stringify({ action: "hangup", callSid: sid }) });
    expect(await hangup.text()).toContain("<Hangup/>");
    const failed = await signedPost("/relay/action", { CallSid: sid, SessionStatus: "failed", CallStatus: "in-progress", ErrorCode: "64107" });
    const xml = await failed.text();
    expect(xml).toContain("lost the connection");
    expect(xml).toContain("<Dial");
  });

  it("/relay upgrades into the call's Durable Object", async () => {
    const res = await worker.fetch("https://voice.example.com/relay/CA22222222222222222222222222222222", {
      headers: { upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    const ws = res.webSocket!;
    ws.accept();
    ws.send(JSON.stringify({ type: "info" }));
    ws.close(1000, "done");
  });

  describe("relay handshake signature", () => {
    const sid = "CA33333333333333333333333333333333";
    const upgrade = (headers: Record<string, string> = {}) =>
      worker.fetch(`https://voice.example.com/relay/${sid}`, { headers: { upgrade: "websocket", ...headers } });
    const accepted = (res: Response) => {
      expect(res.status).toBe(101);
      res.webSocket!.accept();
      res.webSocket!.close(1000, "done");
    };
    const enforce = (on: boolean) => {
      (config.twilio as { validateRelaySignature: boolean }).validateRelaySignature = on;
    };

    it("is report-only by default", () => {
      expect(config.twilio.validateRelaySignature).toBe(false);
    });

    it("a handshake signed over the wss:// URL (no params) passes, also when enforced", async () => {
      const signature = await twilioSignature(TOKEN, `wss://voice.example.com/relay/${sid}`, {});
      accepted(await upgrade({ "x-twilio-signature": signature }));
      enforce(true);
      try {
        accepted(await upgrade({ "x-twilio-signature": signature }));
      } finally {
        enforce(false);
      }
    });

    it("the https:// form and a trailing slash are accepted when enforced", async () => {
      enforce(true);
      try {
        accepted(await upgrade({ "x-twilio-signature": await twilioSignature(TOKEN, `https://voice.example.com/relay/${sid}`, {}) }));
        accepted(await upgrade({ "x-twilio-signature": await twilioSignature(TOKEN, `wss://voice.example.com/relay/${sid}/`, {}) }));
      } finally {
        enforce(false);
      }
    });

    it("an unsigned or wrongly signed handshake passes in report mode", async () => {
      accepted(await upgrade());
      accepted(await upgrade({ "x-twilio-signature": "bogus=" }));
    });

    it("an unsigned or wrongly signed handshake gets 403 when enforced", async () => {
      enforce(true);
      try {
        expect((await upgrade()).status).toBe(403);
        expect((await upgrade({ "x-twilio-signature": "bogus=" })).status).toBe(403);
        const otherToken = await twilioSignature("not-the-token", `wss://voice.example.com/relay/${sid}`, {});
        expect((await upgrade({ "x-twilio-signature": otherToken })).status).toBe(403);
      } finally {
        enforce(false);
      }
    });
  });

  it("unknown paths are 404", async () => {
    expect((await worker.fetch("https://voice.example.com/nope")).status).toBe(404);
  });
});
