# voice — JetNine inbound AI voice agent

Lives in `voice/` of the JetNine website repo; it is its own Node project with
its own dependencies and deploys separately (Render, not Vercel).

Inbound AI voice agent for JetNine. Twilio answers the call, ConversationRelay
handles speech in both directions, and this service runs the conversation
with Claude over a WebSocket — text only, no audio handling.

```
caller ──▶ Twilio number ──▶ POST /twiml ──▶ <Connect><ConversationRelay>
                                                    │ wss://…/relay (JSON text frames)
                                                    ▼
                                      this service: per-call session
                                        ├─ Claude (streaming, tools)
                                        ├─ Supabase (calls, leads, trips, messages)
                                        └─ escalation → end session with handoffData
                                                    │
                              POST /relay/action ◀──┘ → <Dial> on-call broker
```

## What it does

- Answers 24/7 with a fixed greeting spoken instantly (no model round trip).
- Qualifies charter leads conversationally and saves them **as fields arrive**
  (`save_lead` upserts the same lead/trip throughout the call).
- Answers brokerage FAQs; never quotes a price, tail number, or availability.
- Takes messages for non-charter calls (`save_message`).
- Escalates by warm transfer when: departure within 48h, caller asks for a
  human (first ask, also caught by a regex safety net before the model runs),
  returning client with an active trip, two failed turns, or any in-progress
  flight / safety matter. If the broker does not answer, the caller is told
  they will be called back and the desk gets an SMS.
- Sends an SMS lead summary for every lead/escalated call (behind
  `SMS_ALERTS_ENABLED` — see A2P note below).
- Records calls via the Twilio REST API (started on `setup`), stores the
  recording URL, and logs the full transcript with interrupted turns
  truncated to what the caller actually heard.

## Layout

```
src/
  server.ts          Fastify: /twiml, /relay (WS), /relay/action, /escalation/result, /recording-status, /health
  twiml.ts           <Connect><ConversationRelay>, <Dial> transfer, fallback, hangup
  config.ts          env parsing — TTS/STT settings live here
  relay/session.ts   per-call state machine (setup → turns → interrupt → end/escalate)
  relay/messages.ts  ConversationRelay message types
  llm/agent.ts       Claude streaming tool loop, abortable for barge-in
  llm/prompt.ts      persona + per-call context block
  llm/tools.ts       save_lead, save_message, escalate, lookup_caller, end_call
  db/                Supabase service-role client + queries
  escalation.ts      recording start, SMS alert
(schema)             ../src/db/migrations/0038_voice_agent.sql — voice_calls, voice_leads, voice_trip_requests, voice_messages
```

Tables carry a `voice_` prefix because they live in the shared JetNine
Supabase project, which already has a `messages` table. RLS is on with no
policies: only the service-role key can read or write them.

## Local development

1. `cd voice`, then `cp .env.example .env` and fill it in. `PUBLIC_HOST` must be the public
   hostname Twilio can reach — for local dev, an ngrok host.
2. `pnpm install && pnpm dev`
3. Tunnel: `ngrok http 3000` → set `PUBLIC_HOST=<subdomain>.ngrok-free.app`.
4. In the Twilio console, point the number's Voice webhook (HTTP POST) at
   `https://<PUBLIC_HOST>/twiml`.
5. Call the number. `LOG_RELAY_MESSAGES=true` (default outside production)
   logs every raw ConversationRelay frame — keep it on while iterating.

Signature validation is enforced in production
(`TWILIO_VALIDATE_SIGNATURES` defaults to true when `NODE_ENV=production`).

## Changing the voice

Everything speech-related is in `.env` and read once in `src/config.ts`:

| Variable | Meaning |
| --- | --- |
| `TTS_PROVIDER` | `ElevenLabs` (ConversationRelay default) |
| `TTS_VOICE` | ElevenLabs voice ID from Twilio's ConversationRelay catalog. Tune with a suffix: `<voiceId>-<speed>_<stability>_<similarity>`, e.g. `XrExE9yKIg1WjnnlVkGX-1.0_0.6_0.8` |
| `TTS_MODEL` | `flash_v2_5` for latency |
| `STT_PROVIDER` / `STT_MODEL` | `Deepgram` / `nova-3` |
| `RECORDING_ENABLED` | when true the greeting discloses recording |

Leave `TTS_VOICE` empty to use the provider default. Jet's cloned ElevenLabs
voice is a later phase: the native integration only exposes Twilio's
catalog, so the swap will be a single env change once available.

## Deploy (Render)

The WebSocket server needs a long-lived process: deploy as a Render **Web
Service** (not Vercel).

- Repository: this repo, **Root Directory `voice`**. Runtime: Node 22.
  Build: `pnpm install && pnpm build`. Start: `pnpm start`.
- Vercel skips site builds for commits that only touch `voice/` (see `vercel.json` → `ignoreCommand`).
- Health check path: `/health`.
- Set every variable from `.env.example`; `PUBLIC_HOST` is the Render
  hostname (`<service>.onrender.com`). Render terminates TLS, so `wss://` works
  with no extra config.
- Then point the Twilio number's Voice webhook at
  `https://<service>.onrender.com/twiml`.

## SMS alerts and A2P

Outbound SMS from a new Twilio number needs A2P 10DLC (local number) or
toll-free verification before it delivers reliably. `SMS_ALERTS_ENABLED`
defaults to `false`; the alert text is logged instead of sent. Flip it on
once registration clears. Voice webhooks need no registration.

## Escalation mechanics

1. The model calls `escalate` (or the regex net fires on "let me talk to a
   person"). The session speaks the handoff line, persists the call as
   `escalated`, and sends ConversationRelay `{type:"end", handoffData}`.
2. Twilio requests `POST /relay/action` with `HandoffData`; we answer with
   `<Dial timeout=25>` to `ESCALATION_PHONE`, caller ID set to the JetNine number.
3. `POST /escalation/result` receives `DialCallStatus`. Anything but
   `completed` plays the callback reassurance, hangs up, and sends the
   "broker missed" SMS.

## Open items (see the hand-off brief)

Twilio number choice, `ESCALATION_PHONE` / `ALERT_PHONE` values, recording
consent default (California is two-party consent; the greeting discloses
when `RECORDING_ENABLED=true`), and the ElevenLabs voice pick.
