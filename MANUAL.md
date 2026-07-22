# JetNine — System Manual

A practical guide to operating the JetNine platform: the public website, the
member portal, and the dispatch desk. Written for new staff and anyone who
needs to understand how a request becomes a flight. Technical references live
elsewhere (`RBAC.md` for permissions detail, `DEPLOY.md` for infrastructure,
`TESTING.md` for the smoke harness); this document is about *using* the system.

---

## 1. What this system is

JetNine is a Part 295 indirect air carrier — a charter brokerage. The platform
runs the whole funnel on one Next.js app backed by Postgres (Supabase):

```
visitor → quote wizard → dispatch desk works the quote → priced option sent
       → customer accepts → convert to TRIP (+ invoice) → member pays (Stripe)
       → trip flown, statuses tracked → audit trail of everything
```

Three surfaces, one database:

| Surface | URL | Who |
|---|---|---|
| Public site | `/` and marketing pages, `/quote` wizard | Anyone |
| Member portal | `/account/*` | Signed-in customers |
| Dispatch desk | `/admin/*` | Staff (dispatcher and up) |

## 2. Vocabulary and reference codes

Every important object has a human-readable code. Learn these and you can
navigate anything:

| Code | Object | Example |
|---|---|---|
| `JN-YYYY-NNNNN` (5 digits) | Quote | `JN-2026-00029` |
| `JN-YYYY-NNNN` (4 digits) | Trip | `JN-2026-0001` |
| `INV-YYYY-NNNN` | Invoice | `INV-2026-0001` |
| `M-YYYY-NNNN` | Member | `M-2026-0001` |
| `EL-YYYY-NNNN` | Empty leg | `EL-2026-0007` |
| `N…` | Aircraft tail number | `N336SK` |

Other vocabulary: a **leg** is one flight segment (KVNY → KLAS); a **soft
hold** is a tentative claim on an aircraft for a quote; the **reserve** is a
member's prepaid balance; **FET** is the 7.5% federal excise tax; the
**segment fee** is the per-passenger-per-leg IRS fee.

## 3. Signing in

There are no passwords. All sign-in is by **magic link**:

1. Go to `/sign-in`, enter your email, click **Email me a link**.
2. The email arrives from `JetNine <dispatch@jetnine.com>` within seconds.
3. Click the link — you land signed in.

Rules worth knowing:
- Links are **single-use** and expire after **10 minutes**. A used or expired
  link shows "Email link is invalid or has expired" — just request a new one.
- The link must be opened in the **same browser** that requested it (PKCE).
- `/sign-in?next=/admin/dispatch` sends you straight to a destination after
  sign-in. Only same-origin destinations are honored.
- Members land on `/account`; staff can go anywhere their role allows.

## 4. Roles

Roles live on the user record and are changed by an admin (or SQL). Full
detail in `RBAC.md`; the short version:

| Role | Can do |
|---|---|
| `member` | Own portal (`/account`): trips, invoices, memberships, preferences |
| `dispatcher` | Everything members can, plus the whole dispatch desk: work quotes, trips, holds, messaging, empty legs |
| `admin` | Everything dispatchers can, plus reference data (aircraft, airports, operators) and member invites/roles |
| `superadmin` | Everything; role promotions to admin+ are superadmin/SQL-only |

A member who tries to open `/admin` is bounced to `/account?denied=admin`.
The same rules are enforced again at the database layer (RLS), so there is no
URL trick around them.

## 5. The customer journey (public site)

### 5.1 Pages
Marketing pages: `/` (home), `/aircraft` (+ `/aircraft/light|midsize|supermid|heavy|ultra`),
`/memberships`, `/how-it-works`, `/about`, `/safety`, `/faq`, `/legal`,
`/contact`, `/empty-legs`. The dispatch phone (+1 424 487-2707) appears in the
header/footer site-wide.

### 5.2 The quote wizard (`/quote`)
Four steps, draft auto-saved in the browser (a visitor can leave and resume):

1. **Mission** — trip type (one-way / round trip / multi-leg), airports
   (search by name/IATA/ICAO), dates (past dates are blocked), times,
   passengers. Distance is computed per leg.
2. **Aircraft & preferences** — category, cabin preferences, catering, ground
   transport.
3. **Contact** — name, email, phone, preferred contact methods, two required
   consents (Part 295 broker disclosure + contact consent), optional
   marketing opt-in.
4. **Review** — submit. On success the visitor gets a `JN-` reference and the
   promise of a response within 30 minutes.

What happens server-side on submit: the quote row + legs are written, the
customer gets an acknowledgment email, dispatch gets an alert email, an
analytics event fires, and the audit log records the submission. **If the
visitor was signed in, their member record is linked automatically** — that
matters later at conversion (§7.4).

### 5.3 Contact form (`/contact`)
Reason-based (Quote / Card / Existing trip / Other) — route fields are only
mandatory for quote requests. Submissions land in the admin inquiries queue
and fire a dispatch email.

### 5.4 Empty legs (`/empty-legs`)
The public board lists every leg with status `live` — discounted repositioning
flights. Visitors can join the **watchlist** with their email. Publishing and
removing legs is a dispatch-desk action (§7.7).

### 5.5 Abuse protections (invisible to real customers)
- **Rate limiting**: max 5 quote submissions and 5 contact sends per IP per
  5 minutes; over the limit, a polite "too many sends" message.
- **Honeypot**: a hidden form field bots auto-fill; those submissions are
  silently dropped while showing the bot a fake success.
- **Idempotency**: a double-clicked or retried quote submit cannot create a
  duplicate.
- **Validation**: past dates, malformed emails, oversized notes (800 chars)
  are rejected on both client and server.

## 6. The member portal (`/account`)

What a signed-in customer sees:

| Section | Contents |
|---|---|
| **Trips** | Their trips with live status (confirmed → … → completed), routes, dates |
| **Invoices** | Each invoice with totals; a **Pay now** button on `due`/`overdue` invoices that opens Stripe Checkout |
| **Memberships** | Their program + reserve balance; buy/top-up via Stripe |
| **Members** | Companion travelers on the account |
| **Preferences** | Contact and travel preferences |

Membership programs: `on_demand` (default), JetNine Card tiers
(`card_100/250/500`) and Reserve tiers (`reserve_50/100/250/500_apply`). A
funded Reserve is a prepaid balance: when a trip is converted, the invoice can
be **drawn down from the reserve automatically and instantly marked paid** —
no card step. The reserve ledger records every top-up, draw, refund, and
adjustment.

Paying an invoice by card: **Pay now** creates a Stripe Checkout session and
redirects to Stripe's hosted page. Payment confirmation comes back via
webhook and flips the invoice to `paid` (usually within seconds). The system
prevents double-payment: a second Pay click while a session is open is
refused (see Troubleshooting).

## 7. The dispatch desk (`/admin`)

### 7.1 Daily rhythm
Start at **`/admin/dispatch`** — the inbox of open quotes, each showing its
**SLA clock** (every quote carries a 30-minute first-response deadline from
submission; the badge goes warn → critical as it ages). Also check
**`/admin/inquiries`** for contact-form messages (triage `new` → `handled`).

### 7.2 The quote workbench (`/admin/quote/[id]`)
One page per quote — everything happens here:

- **Status** (top right). The lifecycle:

```
submitted → triaged → sourcing → options_sent → accepted → converted
                                      ↘ held ↗        ↘ declined / expired / cancelled
```

  Setting `options_sent` or `held` stamps the response time for SLA tracking.
- **Dispatcher assignment** — who owns this quote.
- **Contact card** — the customer snapshot, with a badge: **MEMBER** (linked
  to a member account), RETURNING, or GUEST. The **Member control** here
  attaches or detaches a member record (see §7.4 for why this matters).
- **Thread composer** — messages on the quote: channel `email` actually
  sends (via Resend, delivery status shown); `sms`/`whatsapp` will send once
  Twilio is wired; `inapp`, `call`, `voicemail` are records of out-of-band
  contact. Use this to send priced options.
- **Indicative pricing** — low/high range; the midpoint seeds the invoice at
  conversion.
- **Soft holds** — tentatively block an aircraft for this quote (visible on
  the ops calendar). Holds derive their window from the quote's legs and are
  auto-released at conversion. Multiple dispatchers can hold the same tail
  for different quotes; resolution is human.

### 7.3 Pricing a quote
Typical sequence: `triaged` → source aircraft (`sourcing`, optionally soft-hold
tails) → set the indicative range → compose the priced option in the thread
(channel email) → `options_sent` → customer agrees → `accepted`.

### 7.4 Member linkage (read this twice)
**A quote must be linked to a member before it can become a trip.** Two ways
that happens:

1. The customer was **signed in** when they submitted — linked automatically.
2. A dispatcher uses the **Member control on the workbench Contact card** to
   attach a member by hand.

Why it's manual for guest quotes: matching by typed email would let anyone
submit a quote with someone else's email and have a trip + invoice attached
to (and auto-drawn from the reserve of) the victim's account. **The session
is the proof of identity — never the typed email.** Before attaching a member
to a guest quote, verify the person is who they claim (call them back on the
number on file). Attachment is audited and locked once converted.

If the member doesn't exist yet, create them first at `/admin/member`
(invite flow) — then attach.

### 7.5 Convert to trip
On an `accepted`, member-linked quote, **Convert to trip** does all of this
atomically:

- creates the **trip** (status `confirmed`) + its legs
- creates the **invoice** — subtotal from the indicative midpoint, +7.5% FET,
  + segment fees ($5.20 × pax × legs); if the member has reserve balance
  covering the total, it's **drawn down and the invoice is instantly `paid`**;
  otherwise the invoice opens as `draft` for review
- releases this quote's soft holds
- marks the quote `converted` and writes the audit entries

Conversion is idempotent — a double-click cannot create two trips.

### 7.6 Trips (`/admin/trip`)
The trip workbench tracks the operational lifecycle:

```
draft → confirmed → crew_briefed → boarding → airborne → wheels_down → completed
       (or: cancelled_wx / cancelled_other / diverted / irregular_ops)
```

Status changes are audited and visible to the member in their portal in real
time. `/admin/ops` shows the 14-day planner with schedule blocks and holds;
`/admin/reports` aggregates volume and revenue.

### 7.7 Empty legs (`/admin/empty-leg`)
Publish a repositioning leg (tail, route, wheels-up, seats, full-charter
reference price, listed price → discount computed). **Status drives public
visibility**: only `live` legs appear on `/empty-legs`. Use the status select
on each row to move a leg through `draft / scheduled / live / sold /
cancelled / expired` — flipping a sold or stale leg off `live` removes it
from the public board immediately.

### 7.8 Reference data (admin role and up)
- `/admin/aircraft` — fleet records (tail, model, category, seats, operator,
  status; `sold` tails can't be held)
- `/admin/airports` — airport catalog (4-char ICAO enforced)
- `/admin/operators` — Part 135 operators + their contacts and FBO notes
- `/admin/member` — member roster, invites, the member 360° view (quotes,
  trips, ledger, program)

### 7.9 Audit log (`/admin/audit`)
Every meaningful action writes an immutable audit row: who (user + role),
what (action + before/after diff), on which object, when. Quote submissions,
status changes, member attach/detach, conversions, messages with delivery
results, empty-leg changes, payments. When something looks odd, the audit log
is the first stop — it is the system's memory.

### 7.10 Health (`/admin/health`)
Live integration status (same data as the public `/api/health` JSON):
database latency, Stripe (live mode + webhook), email outbound, Sentry,
PostHog, Twilio. **Expected reds today**: Twilio (SMS not wired) and email
*inbound* (reply ingestion, Postmark — not wired). Everything else should be
green; if the DB row goes red the whole status flips `unhealthy` — that's a
page-someone event.

## 8. Email

All transactional mail sends from `JetNine <dispatch@jetnine.com>` via Resend
(domain verified). `dispatch@` has no inbox — replies route to the owner.
What sends automatically:

| Trigger | To |
|---|---|
| Magic link requested | the requester |
| Quote submitted | customer (acknowledgment) + dispatch (alert) |
| Contact form submitted | dispatch (alert) |
| Thread message, channel email | the quote's contact |
| Member invite | the invitee |

Delivery results are recorded on the message and in the audit log. `[SMOKE]`
prefixed test submissions (see §10) skip all email.

## 9. Analytics and monitoring

- **PostHog** captures pageviews, session replays, and product events
  (`quote_submitted`, `contact_inquiry_submitted`,
  `empty_leg_watchlist_created`). ⚠️ The PostHog project is **shared with two
  other sites** (mattressstoreslosangeles.com, thelookhairsalonla.com) by
  owner decision — **always filter dashboards and insights by
  `$host = jetnine.com`** or the numbers blend three businesses.
- **Sentry** (org `jetnine`, project `jetnine-website`) captures browser and
  server errors plus performance traces. Zero-error days are normal; check it
  whenever a user reports "something went sideways".
- **Vercel** runtime logs hold server-side console output; `/api/health` is
  the machine-readable status endpoint (public, sanitized).

## 10. Conventions and safeguards

- **`[SMOKE]` prefix**: a quote submitted with a first name starting with
  `[SMOKE]` is treated as an automated test — it lands in the DB
  pre-cancelled, fires no emails, and never hits the dispatch inbox. The CI
  smoke suite uses this; you can too.
- **Rate limits** (per IP, 5 per 5 minutes) apply to quote and contact
  submissions. The limiter fails open on DB hiccups — a real customer is
  never blocked by our own outage.
- **Single-writer guards** everywhere money moves: idempotent quote submits,
  one-trip-per-quote, one-checkout-per-invoice, webhook event dedup,
  duplicate-membership-activation detection. Double-clicks are harmless.
- Security headers, strict CSP, single-use auth links, open-redirect
  protection on the auth callback, and honeypots are all active — none of
  them need operating, just don't be surprised they exist.

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Email link is invalid or has expired" | Link >10 min old, already used, or opened in a different browser | Request a fresh link, open it in the same browser |
| Convert to trip says "Attach a member to this quote first" | Guest quote, no member linked | Verify identity, then use the Member control on the workbench Contact card (§7.4) |
| Member clicks Pay and sees `PAYMENT_IN_PROGRESS` | A checkout session is already open for that invoice (earlier click / closed tab) | Wait for the session to expire (24 h) or finish it; resume-payment UX is tracked in issue #34 |
| Stale/sold empty leg still on the public board | Status still `live` | Flip its status on `/admin/empty-leg` (§7.7) |
| "TOO MANY SENDS" on a form | Per-IP rate limit | Wait a few minutes, or take it by phone |
| `/api/health` says `degraded` | An optional integration is unconfigured (today: Twilio) | Expected; only `unhealthy` (DB down) is an incident |
| A write shows "Something went sideways" but the change saved | Transient response-stream drop; the write committed | Reload to confirm; if it recurs, check Sentry/logs |
| Invoice stuck in `draft` with no totals | Admin finalize UI not built yet | Tracked as C.3 in issue #34; interim: ops sets totals + `due` directly in the DB |

## 12. Known gaps (tracked)

| Gap | Where tracked |
|---|---|
| Admin invoice finalize (draft → due, line items) + Pay-resume UX | Issue #34 (the "C.3" work) |
| Twilio SMS/WhatsApp sending | Env wiring, deferred |
| Inbound email reply ingestion (Postmark) | Deferred |
| Founder headshots, membership pricing confirmation | Issue #30 (F, G) |
| Full live payment + refund exercise | Owner deferred until after domain switchover |

---

*Maintained alongside the code — when a workflow changes, change this file in
the same PR.*
