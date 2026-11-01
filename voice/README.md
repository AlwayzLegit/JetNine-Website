# voice — JetNine inbound AI voice agent

Lives in `voice/` of the JetNine website repo; it is its own project with
its own dependencies and deploys separately, as a Cloudflare Worker
(`jetnine-voice`, at `voice.jetnine.com`) with one Durable Object per call.

Inbound AI voice agent for JetNine. Twilio answers the call, ConversationRelay
handles speech in both directions, and this service runs the conversation
with Claude over a WebSocket — text only, no audio handling.

```
caller ──▶ Twilio number ──▶ POST /twiml ──▶ <Connect><ConversationRelay>
                                                    │ wss://…/relay (JSON text frames)
                                                    ▼
                     Worker → CallRelay Durable Object (one per CallSid)
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
  worker.ts          Worker entry: /twiml, /relay (WS), /relay/action, /escalation/*, /recording-status, /health
  call-relay.ts      CallRelay Durable Object: holds the relay WebSocket + CallSession for one call
  twilio.ts          signature validation (WebCrypto HMAC-SHA1) and REST calls (fetch); no twilio SDK
  env.ts             Worker vars + secrets (replaces process.env)
  log.ts             JSON console logger (Workers Logs)
  twiml.ts           <Connect><ConversationRelay>, <Dial> transfer, fallback, hangup
  config.ts          config parsing — TTS/STT settings live here
  relay/session.ts   per-call state machine (setup → turns → interrupt → end/escalate)
  relay/messages.ts  ConversationRelay message types
  llm/agent.ts       Claude streaming tool loop, abortable for barge-in
  llm/prompt.ts      persona + per-call context block
  llm/tools.ts       save_lead, save_message, escalate, lookup_caller, end_call
  db/                Supabase service-role client + queries
  escalation.ts      recording start, SMS alert (Twilio REST via twilio.ts)
wrangler.jsonc       Worker config: nodejs_compat, Durable Object, vars, voice.jetnine.com route
(schema)             ../src/db/migrations/0038_voice_agent.sql — voice_calls, voice_leads, voice_trip_requests, voice_messages
```

Tables carry a `voice_` prefix because they live in the shared JetNine
Supabase project, which already has a `messages` table. RLS is on with no
policies: only the service-role key can read or write them.

## How a call maps onto Workers

- Twilio webhooks (`/twiml`, `/relay/action`, `/escalation/*`,
  `/recording-status`) are plain Worker requests. Each is checked against
  `X-Twilio-Signature` (HMAC-SHA1 over `https://<PUBLIC_HOST><path+query>`
  plus the sorted form params; see `src/twilio.ts`) when
  `TWILIO_VALIDATE_SIGNATURES` is on. That is the default with
  `NODE_ENV=production`, which `wrangler.jsonc` sets.
- The `/relay` WebSocket handshake is checked too, over the socket URL with
  no params (`wss://` or `https://`, with or without a trailing slash). It
  is report-only until `TWILIO_VALIDATE_RELAY_SIGNATURE=true` (see Cutover).
- `/twiml` puts the CallSid in the relay URL: `wss://<PUBLIC_HOST>/relay/<CallSid>`.
  The Worker routes that upgrade to the `CallRelay` Durable Object named by
  the CallSid, which accepts the socket and runs `CallSession`
  (`src/relay/session.ts`) as the Node process did. A bare `/relay` (from an
  old TwiML document) still works, in a one-off object.
- `/relay/action` with `SessionStatus=failed` calls that same object over
  RPC (`relayFailed`) to save the transcript before transferring or
  reconnecting. The one reconnect of a no-transfer call lands in the same
  object, so the conversation carries over.
- No cold start: Workers start in milliseconds, so Render's free-plan
  sleep after 15 idle minutes is gone.

## Local development

1. `cd voice && pnpm install`
2. `cp .env.example .dev.vars` and fill it in. `PUBLIC_HOST` must be a host
   Twilio can reach, e.g. a tunnel to the dev server
   (`cloudflared tunnel --url http://localhost:8787`, or ngrok).
3. `pnpm dev` (`wrangler dev`, port 8787). `GET /health` reports what is missing.
4. To take real calls locally, point a **test** number's Voice webhook at
   `https://<PUBLIC_HOST>/twiml`. `LOG_RELAY_MESSAGES=true` logs every raw
   ConversationRelay frame.
5. `pnpm typecheck` and `pnpm test`. Tests run inside workerd through
   `@cloudflare/vitest-plugin` (the renamed `@cloudflare/vitest-pool-workers`)
   with the bindings from `wrangler.jsonc`, overridden in `vitest.config.ts`.
   After changing `wrangler.jsonc`, run `pnpm types` to regenerate
   `worker-configuration.d.ts`.

## Which model answers

The vendor and model are chosen at **`/admin/settings/ai`** on the site, not
by env. An admin stores an Anthropic and/or OpenAI key there (encrypted with
`AI_KEYS_ENCRYPTION_KEY`, which this service must also have), gives each a
default model, and sets the **Voice desk** route: a primary provider and an
optional fallback. `src/llm/providers.ts` reads that at the start of each
turn (cached 60 s, last good answer kept through a database blip).

- Primary runs every turn. If it fails before the caller has heard anything,
  the same turn is retried once on the fallback (`src/llm/agent.ts`).
- Adapters: `src/llm/anthropic.ts` (Messages API, streaming, tools) and
  `src/llm/openai.ts` (Chat Completions, streaming, function tools). Both
  read and write the provider-neutral history in `src/llm/history.ts`, which
  is what makes a mid-call switch possible.
- With no route in the admin, `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` are
  used, so the old env-only setup still works.
- `/health` reports the resolved routing (`llm.primary`, `llm.fallback`,
  `llm.note`) with no key material, and is 503 until some provider resolves.

## Changing the voice

The env defaults below are `vars` in `wrangler.jsonc` (`.dev.vars` locally), read once in `src/config.ts`:

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

## Deploy (Cloudflare Workers)

This needs the Workers Paid plan, for Durable Objects that hold a
WebSocket for a whole call. Non-secret settings are `vars` in
`wrangler.jsonc`. The route is the custom domain `voice.jetnine.com` on the
`jetnine.com` zone, and `wrangler deploy` creates it.

```bash
cd voice
pnpm install
npx wrangler login
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_NUMBER
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put AI_KEYS_ENCRYPTION_KEY      # same value as the site
npx wrangler secret put ESCALATION_PHONE
npx wrangler secret put ALERT_PHONE
npx wrangler secret put ANTHROPIC_API_KEY           # optional fallback
npx wrangler deploy
curl https://voice.jetnine.com/health               # 200 once call-ready
```

If the Worker does not exist yet, the first `wrangler secret put` creates it
with only the secret, and `wrangler deploy` then uploads the code. To change
a non-secret setting (`TTS_VOICE`, `SMS_ALERTS_ENABLED`, ...), edit `vars` in
`wrangler.jsonc` and deploy again. For logs, run `npx wrangler tail` or open
Workers Logs in the dashboard.

## Cutover from Render (zero downtime)

Render keeps answering until the last step. Both services read and write
the same Supabase tables, so they can run side by side.

1. Deploy as above. Check that `https://voice.jetnine.com/health` returns 200
   with the expected `llm.primary`.
2. Test with a **second Twilio number** pointed at
   `https://voice.jetnine.com/twiml`. Run the three scripted calls from the
   runbook below, plus a transfer and a broker no-answer.
   After a staging test call logs `relay: handshake signature verified`
   (`npx wrangler tail`), set `TWILIO_VALIDATE_RELAY_SIGNATURE` to `"true"`
   in `wrangler.jsonc` and deploy again, so an unsigned relay handshake gets
   403. Until then a mismatch is only logged
   (`relay: handshake signature did not verify (report-only)`).
3. **Twilio number webhook.** Go to Console → Phone Numbers → the JetNine
   number → Voice → *A call comes in*. If it points at this service
   directly, change `https://jetnine-voice.onrender.com/twiml` to
   `https://voice.jetnine.com/twiml` (HTTP POST). If it points at the site
   (`https://jetnine.com/api/voice/inbound`, ring-first), leave it and do
   step 4. Calls already in progress finish on Render, because their
   callback URLs carry the Render host. New calls go to the Worker.
4. **Site redirect.** The main app's ring-first routes
   (`src/app/api/voice/*`) redirect missed calls to the agent and ping its
   `/health`. Set `VOICE_AGENT_URL=https://voice.jetnine.com` wherever the
   site runs, or change the `https://jetnine-voice.onrender.com` default in
   those routes, then redeploy the site. This change belongs to the main
   app, not to this directory. The site's wake-up ping and voicemail
   fallback can stay; with no cold start they do no harm.
5. Watch `npx wrangler tail` through a few real calls, then suspend the
   Render service. Delete it after a quiet week.

To roll back, point the webhook (or `VOICE_AGENT_URL`) back at Render.

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

## Ring-first routing (the site in front of the agent)

Twilio's "A call comes in" can point at the site instead of this service:
`https://jetnine.com/api/voice/inbound`. The site reads Admin › Settings ›
Voice agent › Routing and either rings the team's numbers first
(`<Dial timeout=rings×6 answerOnBridge>`) or goes straight on. A missed
call is redirected here as `POST /twiml?missed=1`: a **no-transfer call**.
The caller hears the normal greeting; a `<Parameter name="noTransfer">`
tells the session, which skips the human-ask transfer, makes the escalate
tool refuse, and adds a NO-TRANSFER block to the call context so the agent
takes the details and arranges a broker callback instead. If the relay
fails on such a call the agent reconnects once with the conversation
carried over (`?reconnect=1`), then reassures and hangs up; it never
dials the team. The site pings `/health` the moment a call arrives so a
sleeping instance (Render's free plan; the Worker has no cold start) boots during the rings, holds the caller while
it wakes, and takes a voicemail if it never does. Ring-first and the
agent's transfer to the broker both use press 1 to accept (`<Number url>`
screening): only a 1 bridges, and the Dial action reads `DialBridged`
because an unaccepted screened leg still reports `DialCallStatus=completed`. `VOICE_AGENT_URL` on
the site overrides `https://jetnine-voice.onrender.com` (see Cutover).

## Voice agents (Settings › Voice agent › Agents)

Everything about how the agent sounds and behaves is edited on the site,
not in env vars: greeting and language; voice (provider, voice ID, model,
speed, stability, similarity); listening (speech model, end-of-speech
wait, interruption sensitivity, backchannel filter, greeting
interruptible, hints); the AI model override; instructions, personality,
knowledge and never-say list; and call handling (which transfer triggers
are on, the transfer number, asking for a callback time, longest call).
Every save is a version that can be restored; one agent is live.

This service reads the live agent from `voice_agents` (cached 30 s, last
good answer kept if Supabase is down), builds the `<ConversationRelay>`
from it and passes the agent id to the session as a `<Parameter>`. The
session builds the system prompt from the agent (`agentPersona`), enforces
the transfer switches in the escalate tool and the human-ask rule, uses
the agent's transfer number, and logs `turn: timing` (first token and
total ms) for every reply. With no live agent it runs the built-in
defaults (`src/agent-config.ts`) with TTS/STT from the env as before. The
site and this service share those defaults; `pnpm check:api` on the site
fails if they drift.

## Going live — runbook

1. **Worker**: `jetnine-voice` at https://voice.jetnine.com (see Deploy).
   `/health` returns 503 with `missingEnv` until every secret is set, then 200.
2. **Secrets** with `wrangler secret put` (see Deploy), `AI_KEYS_ENCRYPTION_KEY`
   with the same value as the site. Then store the model vendor key at
   `/admin/settings/ai` and route the Voice desk to it; `ANTHROPIC_API_KEY`
   is only a fallback.
3. **Twilio number.** Buy a voice-capable number (a fresh one for testing is
   fine). Console → Phone Numbers → the number → Voice → *A call comes in*:
   Webhook, `https://voice.jetnine.com/twiml`, HTTP POST. Save.
   ConversationRelay needs the account's AI/ML features addendum accepted once
   (Console prompts for it on first use).
4. **Existing JetNine number on a SIM.** Keep it. Set carrier call forwarding
   from the SIM number to the Twilio number — unconditional for a full
   takeover, or busy/no-answer if a human should get first pick. Twilio passes
   the original caller ID through and the `setup` message carries
   `forwardedFrom`. If forwarding is unconditional, `ESCALATION_PHONE` must be
   a different number or the transfer loops back to the agent.
5. **First calls.** Run three scripted calls and check Supabase after each:
   - "Flying tomorrow" → expect a `voice_leads` + `voice_trip_requests` row with
     `urgency = within_48h`, an `escalated` call outcome, and a transfer.
   - Ordinary quote, dates next month → lead saved, call ends with `lead`.
   - "Let me talk to a person" → immediate transfer.
6. **Voice.** Audition with `TTS_VOICE` set to each candidate (see
   `.env.example`), one `wrangler deploy` per voice. Empty means Twilio's default.
7. **SMS alerts.** Complete A2P 10DLC or toll-free verification for the number,
   then set `SMS_ALERTS_ENABLED=true`.

## Open items (see the hand-off brief)

Twilio number choice, `ESCALATION_PHONE` / `ALERT_PHONE` values, recording
consent default (California is two-party consent; the greeting discloses
when `RECORDING_ENABLED=true`), and the ElevenLabs voice pick.
