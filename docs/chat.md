# Site chat (OPS-242)

A small assistant on JetNine's public pages. It answers short questions from a fixed list of facts the site already states, and hands a trip (route, passengers, dates) to the existing quote form. Part 2 of OPS-236; the shared AI Worker is `crew-ai` (AlwayzLegit-Crew, `ai/`, OPS-241).

## What it does

- A button "Ask a question" on the marketing pages only (not admin, not the desk, not the quote flow). It appears only when `GET /api/chat` answers `{"enabled": true}`; with the chat off the visitor sees nothing different.
- The panel opens on the first click. Its first line: "Automated assistant. It cannot quote prices or confirm availability. Please do not share personal details here."
- The visitor's messages go to `POST /api/chat`, which calls `crew-ai` through the service binding `CREW_AI` (`wrangler.jsonc`: `JetNineChat` in production, `JetNineStagingChat` in staging). The site holds no API key.
- The one tool, `start_quote`, fills the quote form's first step. It sends nothing: the visitor presses "Continue to your quote", finishes the form and sends it as today.

## What it never does

- State a price, rate, discount or estimate. An output guard (`src/lib/chat/guard.ts`) cuts an answer where a money amount starts and puts in its place: "For a price, the cost calculator gives an estimate: /cost-calculator."
- Confirm availability, or promise anything. The system text (`prompt.ts`) forbids it and the evals test it.
- Take personal details. A visitor message with an email address or a phone number is not sent to the model; the answer is a fixed notice.
- Keep a transcript. The conversation lives in the browser tab. The server keeps five counters per Pacific day in the D1 table `chat_daily` (sessions, messages, handoffs, guard_hits, fallbacks), nothing else.
- Show an error. Any failure (budget used up, crew-ai down, timeout of 15 seconds, no binding) answers `{ "fallback": true }` and the panel shows one line with links to /contact and the quote form.

## Limits

- Cloudflare Turnstile once per chat session (a signed cookie, 2 hours, covers the rest). Off wherever Turnstile is off.
- 30 messages an hour per address (the site's own limiter, `checkRateLimit`); at most 12 messages from the visitor in a chat; 600 characters each.
- Daily spend: crew-ai's budget for the site (JetNine 2.00 dollars, staging 0.25; OPS-297). At 0 the chat is off.

## Where things live

- `src/lib/chat/`: `facts.ts` (the facts, no money), `prompt.ts`, `guard.ts`, `tool.ts`, `handle.ts` (the core, tested with a stand-in), `session.ts`, `stats.ts`, `crew-ai.ts` (the binding), `evals.ts`.
- `src/app/api/chat/route.ts`, `src/components/chat/`.
- Health: the full `/api/health` view (Bearer CRON_SECRET) has `checks.chat` with `enabled`, `budgetUsd`, `spentTodayUsd`, `handoffs7d`. It is always `ok: true`: chat off or crew-ai down never degrades the site and never appears in `failing`. The public proof is `GET /api/chat`.
- Evals: `tests/chat-evals.json`, `scripts/chat-evals.mts`, workflow `chat-evals.yml` (by hand, staging only, no secret). Every staging deploy of Deploy (Cloudflare) also runs them in its `chat-evals` job (`--gate-never`: red only when a never rule fails, or exit 3 when staging refuses the Turnstile test token), so the evals line is read before any merge.

## Way back

Set the site's budget in crew-ai to 0 (a one-line pull request on AlwayzLegit-Crew, `ai/src/sites.ts`): the button disappears. Or revert the merge; the D1 table stays and is unused.

## Standards

OWASP Top 10 for LLM applications: LLM01 (site content and visitor text are data), LLM02 (no personal data reaches the model), LLM06 (one tool, no send), LLM09 (answers only from the facts, price guard). WCAG 2.2 AA for the panel: keyboard, focus return, labelled controls, a polite live region.
