# Handoff: JetNine simplification redesign

Target repo: `AlwayzLegit/JetNine-Website` (Next.js App Router, Tailwind, `src/app/(marketing)`, `src/app/quote`, `src/app/account`, `src/app/admin`).
Business context: Avinode is the sourcing tool. Operators, aircraft, airports and live ops are NOT managed in this site any more. The site is the **client side** (public pages, quote flow, member account) plus a small **client desk** for staff.

## Overview

The current site is dark, luxurious and dense: mono-caps labels at 10–11px, aviation jargon (PAX, ICAO codes, NM, sectors, SLA), 7 nav items + 24 footer links, 7 account tiles, 15 admin sections. This redesign keeps the brand (near-black ink, bone type, Fraunces serif, the wordmark) and removes the complexity:

- Same information architecture and copy as the live site for the **public pages** (the live site is the reference for flow and content). What changed is the presentation: larger readable type, sentence-case labels, cards with 12px radius, one primary button per screen.
- **Quote flow** keeps the live 4 steps (Mission → Aircraft & preferences → Contact → Review) but every optional group in step 2 and 3 is collapsed by default, category cards grey out with a plain reason, and the sidebar is titled "Your trip so far".
- **Account** keeps the live 7 sections (Overview, Quotes, Trips, Invoices, Membership, Buy / top up, Preferences) as a left rail; the overview page leads with the next trip written as a sentence.
- **Admin** collapses 15 sections to 5: Requests, Trips, Clients, Messages, Settings (Settings holds Reports, Team, Notifications, Connections, History). Statuses become sentences ("Needs a reply", "Working on it", "Options sent", "Booked"). Avinode is linked from the sidebar and from the request page ("Paste Avinode quote").
- A plain-words dictionary (below) applies everywhere.

## About the design files

Every `.dc.html` in this folder is a **design reference built in HTML** — a prototype showing intended look and behaviour. It is not production code. Recreate these designs in the existing Next.js + Tailwind codebase using its components (`site-nav`, `site-footer`, `admin-shell`, the quote store, etc.), extending Tailwind theme tokens where needed. Open any `.dc.html` in a browser to see it; the `<x-dc>` body is plain inline-styled HTML, and the `class Component` block below it holds the demo data and interaction logic (which values are toggled, what each state shows).

Files named `Current - *.dc.html` are pixel recreations of the **live** screens, for side-by-side comparison only. `Wireframes.dc.html` is the round-1 exploration; `Plan my flight.dc.html` and `My flights.dc.html` are earlier one-page alternatives that were superseded by `Quote.dc.html` and `Account.dc.html` — keep them as reference, do not build them.

## Fidelity

**High-fidelity** for all desktop screens listed below: colours, type sizes, spacing, radii and copy are final. Recreate them faithfully.
`Mobile.dc.html` is **mid-fidelity**: it establishes the mobile structure (stacked layout, pinned footers, horizontal strips) and the exact styles, but only six screens are drawn; derive the rest from the desktop pages using the same rules.
`Wireframes.dc.html` is **low-fidelity** and is context only.

## Design tokens

Colours (all existing brand colours or tints of them; no new hues except the two status colours):

| Token | Hex | Use |
|---|---|---|
| ink | `#07080A` | page background |
| ink-2 | `#0A0C10` | admin sidebar, trust bar |
| surface | `#0E1014` | cards, panels, table containers |
| surface-2 | `#161A20` | inputs, hover/selected nav, pills, avatar circles |
| line | `#232830` | card borders, dividers |
| line-2 | `#2C323B` | secondary button borders, chip borders |
| line-faint | `#161A20` | row dividers inside cards |
| bone | `#F4F1EA` | primary text |
| bone-2 | `#C9C4B8` | secondary text, nav links |
| steel | `#8A9099` | tertiary text, labels, placeholders (min contrast 4.5:1 on ink) |
| steel-dim | `#5C636D` | counts next to section labels only |
| clearance | `#E8E2D2` | primary button background, selected states, accents, progress fill |
| gold | `#C9A24A` | "Recommended", "Fastest", discounts, warnings, in-progress dot |
| success | `#8FB58A` | open/confirmed dot |
| danger | `#E07A6B` | overdue, disabled reasons, required asterisk |

Typography:
- Body / UI: **Instrument Sans** 400 / 500 / 600 (Google Fonts; replaces the live site's Inter — a humanist grotesk with more character that still reads at 13px on ink). Base 16px, line-height 1.55. Body copy on public pages 16–19px.
- Display: **Fraunces** (variable, `opsz`) weight 300 for page titles and large numbers, 400 for card titles. Letter-spacing −0.015em to −0.02em on titles.
- Scale: h1 public 56–80px / 1.02; h1 app 36–52px / 1.05–1.1; h2 section 44–48px / 1.08; card title 21–24px / 1.25 (Instrument Sans 500); label 13–14px Instrument Sans 600 in steel; caption 13–14px.
- No uppercase mono labels anywhere. JetBrains Mono is dropped. Load Instrument Sans via `next/font/google` (weights 400/500/600) and set it as the Tailwind `sans` family; Fraunces stays as `serif`.

Spacing & shape:
- Page container `max-width:1200px; padding:0 40px`. Section rhythm on public pages: `padding-top:112px` (128px on Home), final CTA `padding:112px 40px 128px`.
- Grid gaps: 16px between cards, 10px between form fields, 8px between chips.
- Radii: cards/panels 12px, inputs/buttons 8px, chips/pills 999px, nav items 8px.
- Borders: 1px `#232830` on cards; selected card `border:1px solid #E8E2D2; box-shadow:0 0 0 1px #E8E2D2`.
- Shadow: only the Home hero search card, `0 24px 60px rgba(0,0,0,.45)`.
- Hit targets: buttons 44px (secondary) / 52px (primary CTA) / 56px (submit) tall; mobile never below 44px.

Components:
- **Primary button**: bg `#E8E2D2`, text `#07080A`, Instrument Sans 500 15–16px, radius 8px, height 44/52px, `padding 0 20–28px`, trailing `→`. Hover: `#F4F1EA`.
- **Secondary button**: transparent, `1px solid #2C323B`, text bone. Hover: border `#8A9099`.
- **Text link**: bone-2, underline with `text-underline-offset:3px`.
- **Input**: block label 13px bone-2 above the value, container bg `#161A20`, radius 8px, `padding:10px 14px`, value Instrument Sans 16px bone, placeholder steel. Focus: `box-shadow:0 0 0 1px #E8E2D2`.
- **Segmented control**: track `#161A20` radius 8px padding 4px; selected segment bg `#E8E2D2` text ink; others transparent bone-2; height 36px.
- **Chip**: 34–40px tall, radius 999px, `1px solid #2C323B`, bone-2; selected = clearance bg, ink text.
- **Sticky header** (public): 72px, `rgba(7,8,10,.86)` + `backdrop-filter:blur(14px)`, bottom border `#161A20`; wordmark 36px tall; nav links Instrument Sans 15px bone-2, current page bone 500.
- **Footer**: 4 columns (1.6fr 1fr 1fr 1fr), 15px links in bone, 13px legal line. Column headings 14px Instrument Sans 600 steel.
- **Admin shell**: 220px sticky sidebar bg `#0A0C10`, right border `#161A20`; nav items 40px tall radius 8px, current item bg `#161A20`; counts as pills (clearance bg for "Requests", outlined for "Messages"); "Open Avinode ↗" secondary button under the nav; user + sign-out pinned at the bottom.
- **Accordion row** (FAQ, Safety, About): 20–26px title, `+` / `−` on the right in bone-2, 1px `#232830` dividers, only one open at a time.
- **Scrollbars** (admin panes): `scrollbar-width:thin; scrollbar-color:#2C323B transparent`.
- **Scrollbars**: thin, `#2C323B` thumb on transparent track (`scrollbar-width:thin; scrollbar-color:#2C323B transparent`).
- **Status sentences**: never a pill with a code. Colour only on the word that needs it (danger for overdue, gold for "in progress").

## Plain-words dictionary (apply everywhere, including emails/SMS)

| Today | Say instead |
|---|---|
| Pax · 4 PAX | Passengers · 4 passengers |
| Leg 01 / sector / multi-leg | Outbound / Return / Add another leg |
| KVNY · ICAO · VNY→ASE | Los Angeles (VNY) → Aspen (ASE) — city first, code in parentheses |
| 612 NM great-circle | 612 nm shown only in review; elsewhere "about 2 hours" |
| Indicative range · Mission preview | Indicative range (kept) · Your trip so far |
| SLA 18m left / Past SLA | Reply due in 18 min / Reply overdue by 11 min |
| submitted / triaged / sourcing / options_sent / converted | Needs a reply / Working on it / Options sent / Booked |
| Category: supermid | Super-mid jet · up to 9 passengers |
| Reposition sector | Empty leg / repositioning flight |
| FBO Signature KVNY | Where to go: Clay Lacy Aviation, 7435 Valjean Ave, Van Nuys ("private terminal" in prose, never "FBO") |
| Dispatch desk (in admin) | Requests / the desk |
| M-2026-0012, reserve_500_apply | Never show ids or enum keys to users |
| Airframe · FBO · CONUS · transcon · ULR · people | Aircraft · private terminal · continental US · coast to coast · ultra long range · passengers |
| CONUS · transcon · ULR · people | continental US · coast to coast · ultra long range · passengers |

## Screens

### Public site (shared chrome from `jn-chrome.js`: header + footer)

Nav order: Aircraft · Programs (→ Memberships) · How it works · About · Blog · Contact, then "Sign in", phone, primary "Request quote →". Footer columns "Aircraft / Programs / Company" with the live link list, every link resolving.

**Home** — `Home.dc.html`
- Hero: full-bleed `runway-night.webp`, gradients `linear-gradient(90deg, rgba(7,8,10,.94) 0%, .78 45%, .35 100%)` + vertical fade to ink. Eyebrow "Est. 2026 — Los Angeles" 14px 500 bone-2; h1 Fraunces 300 80px "Ready when you are."; sub 19px bone-2; primary "Request a quote →" 52px + secondary phone button; note line 15px.
- Search card inside the hero (max 1080px, bg surface, border `#232830`, radius 12px, padding 16px, shadow): segmented Round trip / One way / Multi-leg; grid `1.3fr 1.3fr 1fr 1fr .9fr auto` of From, To, Depart, Return (dims to 45% opacity and placeholder "One way" when one-way), Passengers stepper (− n +, 28px round buttons), primary "Search →". Link under it: "Need help choosing? Talk to a flight advisor →".
- Trust bar: 7 columns, Fraunces 30px value + 14px steel label (values from `constants.ts`).
- Programs: eyebrow + h2 "Three ways to fly with JetNine.", 3 cards (16/10 image, 24px title Instrument Sans 500, body bone-2, "Explore →").
- The flow: 3 cards with Fraunces 48px "01/02/03".
- Why JetNine: 6 cards, 21px titles; links only on Safety and 24/7 dispatch.
- Aircraft: 6 cards 4/5 image, name 17px, "Up to n passengers", "Range n nm", "View specs →"; "All aircraft →" link top right.
- Discretion split (quote + `tail-night.webp`), final CTA, footer.
- State: `trip` (roundtrip | oneway | multileg), `pax` 1–16.

**Aircraft** — `Aircraft.dc.html`
- Hero (`hero/aircraft.webp`, bottom-aligned text), then a "How many people are flying?" card with a range slider 1–16 and hint text; the compare table (columns Category / Passengers / Range / Speed / Endurance / Sample aircraft / →) highlights the first category that fits (`bg #161A20`, gold "Fits your group") and dims smaller ones to 40% opacity; six detail cards in 2 columns with anchors `#turboprop … #ultra`; CTA "Not sure which fits?".
- State: `pax`. Data from `fleet.ts`.

**Memberships (Programs)** — `Memberships.dc.html`
- Hero (`hero/memberships.webp`), "How many hours a year?" slider 5–200 step 5 which highlights one of the three program cards (On-Demand < 25h, JetNine Card 25–100h, Reserve > 100h) and writes a one-line suggestion; program cards with price, feature list (✓ in clearance) and CTA (primary when highlighted); locked-rates table (Category / Typical mission / On-demand market / Locked card rate) from `rates.ts`; three card tiers (`#deposits`, Preferred tier pre-highlighted); availability commitment 2×2; FAQ accordion (7); CTA.
- State: `hours`, `open` (faq index).

**How it works** — `How it works.dc.html`
- Hero (`hero/how-it-works.webp`), 4-stat strip, five-step explorer: sticky left list (36px numbered circles, filled for done/current) + right detail card with title/body/checklist and Previous / Next step buttons (last step shows "Request a quote →"); pricing stack (6 line items, "All-in $47,260"); app-vs-JetNine comparison table; three promises; FAQ accordion (8); CTA.
- State: `step` 0–4, `open`.

**Contact** — `Contact.dc.html`
- Title, live pill "Dispatch desk open now · average pick-up under 20 seconds · h:mm in Los Angeles" (clock from `America/Los_Angeles`, refresh 30s); three channel cards (Call highlighted with clearance border, Email, Text); form with "What is this about?" chips (Quote a flight / Card / Existing trip / Other) — trip fields show only for Quote and Existing trip, labels get "· optional" for Existing trip, textarea placeholder changes per reason; side notes; four regional dispatcher cards; HQ block with `about/dispatch-room.webp` and Directions button; CTA.
- State: `reason`, `now`.

**About** — `About.dc.html`
- Hero (`hero/about.webp`) with 2×2 fact grid; five beliefs as a Fraunces-numbered accordion; two founder cards (initials placeholder 200px 4/5 — replace with photos); team grid 4 columns (48px initial circles); HQ split; CTA.

**FAQ** — `FAQ.dc.html`
- Search input (420px, ⌕) + quick-tag chips (Deposit, Pets, Wi-Fi, Cancellation, Catering, Customs) that set the query; left topic rail with counts (All topics + 8 topics, from `faq.ts`); right groups of accordion rows; empty state card when nothing matches; three "still stuck" cards.
- State: `query`, `cat`, `open` (question id). Search matches question and answer text, case-insensitive.

**Empty legs** — `Empty legs.dc.html`
- Title "n empty legs, live now." + live-count card (Fraunces 80px count, next departs / furthest / best discount); segmented filter All / Next 48 hours / West coast / East coast / International; leg rows grid `150px 1.4fr 1fr 180px auto`: day+time, City → City (Fraunces 26px) with airports and duration, aircraft + category/seats, price (Fraunces 30px) with struck "was" and gold "n% off", "Call to book" (primary on the featured leg); "Recently sold" line; three how-it-works cards; watchlist form (`#watchlist`, 6 fields + "Text me when one shows up", SMS disclaimer); 6-question 2-column FAQ.
- State: `filter`.

**Safety** — `Safety.dc.html`
- Hero (`hero/safety.webp`); 4 accreditation cards + one plain-English line; funnel of 5 bars (width = count/5000, final row highlighted gold); "The floor" accordion with a 180px area column and a "Preferred:" line in gold; 4 audit-cycle cards; two insurance cards (Fraunces 64px "$300M" / "$500M"); broker-disclosure panel linking to `Legal.dc.html#part-295` and `#operator-detail`; CTA.

**Blog & guides** — `Blog.dc.html`
- Two tabs under the title ("Notes from the desk" / "The pricing guide · 5 chapters", underline `#E8E2D2`). Posts tab: featured post (3fr 2fr) + 3-column grid of 6 + Friday digest signup (email + Subscribe). Guides tab: intro + 5 numbered chapter rows.
- State: `tab`.

**Legal** — `Legal.dc.html`
- Title + meta card (Effective, Last edited, Governing law, Questions, Broker status); required-disclosure banner (`rgba(232,226,210,.05)` bg, clearance border); sticky contents rail (three docs, numbered items with a left rule) + articles: Privacy policy (1.1–1.7), Terms of service (2.1–2.7), Part 295 broker disclosure (3.1–3.4). Section ids as in the file (`#what-we-collect`, `#agreement`, `#part-295`, `#operator-detail`…). Body line-height 1.6, max 72ch.

### Quote flow — `Quote.dc.html` (one component, 4 steps)

- Header 72px: "← Save & exit" left, wordmark centre, "● Dispatch open · +1 (424) 487-2707" right (green dot). Below it a 4-column step bar: 28px number circle (filled clearance for done/current), "Step n of 4" 12px steel + name 15px 500; current step has a 2px clearance underline. Steps are clickable.
- Layout: `grid-template-columns: minmax(0,1fr) 340px`, gap 40px, sticky sidebar at `top:160px`.
- Sidebar "Your trip so far": trip-type tag, legs (From → To, date, time), dl Passengers / Distance / Flight time (+ Aircraft / Catering / Ground from step 2, + Contact on step 3), "Indicative range" Fraunces 30px and note.
- **Step 1 Mission**: eyebrow, h1 "Where, when, how many.", intro (live copy); card with Trip type segmented and one bordered leg block per leg (From, To, Depart date, Depart time), dashed "+ Add another leg"; "Common routes:" chips (city names with codes); Passengers card with 48px stepper and hint sentence; footer "Step 1 of 4 · Draft saves automatically", Cancel, primary "Continue to aircraft →".
- **Step 2 Aircraft & preferences**: h1 "The shape of the flight."; six category cards in 3 columns (name 20px, "Up to n passengers · range n nm", gold "Recommended" top-right, disabled cards at 40% opacity with a danger reason "Too small for n passengers" / "Range short of n nm"); then a stack of collapsed optional sections, each a 12px card whose header shows a title, a one-line summary of the current selection and "Show ▼ / Hide ▲": Cabin preferences (6 toggle tiles 2-col, 36×20 switch), What's on board (4 catering tiles with price in gold), Curb to cabin (3 ground tiles), Anyone or anything else? (Children / Pets / Extra bags steppers), Anything else dispatch should know? (textarea 800 chars + "Add common:" chips + "Visible to dispatch & operator only"). Footer "← Back" + "Continue to contact →".
- **Step 3 Contact**: h1 "How to reach you."; card "New here, or flown with us before?" segmented; Primary contact card (First / Last / Email / Country select + Phone / Company optional); "How should dispatch follow up?" 3 checkbox tiles (Email, Phone call, SMS); collapsed "Optional: best time to reach you & how you heard about us" with two chip rows; "A couple of agreements" — 3 checkbox rows, first two required (danger asterisk). Footer "← Back" + "Continue to review →".
- **Step 4 Review**: h1 "Last look, then we send it."; highlighted range card (`rgba(232,226,210,.04)` bg, clearance border, Fraunces 56px price, right column of 3 reassurance lines); sections "1 · Mission", "2 · Aircraft & preferences", "3 · Contact" each with an underlined **Edit** that jumps to the step; "What happens next" 4 numbered rows with timing in gold; "Send it to dispatch." card with clearance border and 56px primary "Submit quote request →" that goes to the status page.
- State: `step`, `trip`, `pax`, `cat`, `cabin{}`, `catering`, `ground`, `kids/pets/bags`, `open{}`, `account`, name/email/phone, `methods{}`, `bestTime`, `source`, `consent{}`. Price = category base rate × (distance / speed + 0.4h per leg), shown as a ±16% range rounded to $100. Draft persists in the existing quote store.

**Your request (status page)** — `Your request.dc.html`
- Public header variant with "← My account". Title "Los Angeles → Aspen" + sentence with dates and passengers. Three stages driven by `stage` (received | options | booked):
  - received: card "Got it, Dana. We're on it." + 4-step vertical timeline (done = filled clearance circle with ✓, current = gold ring, upcoming = outlined), "Questions? Call" button.
  - options: "Your options are ready" + 3 option rows (200px photo, name + kind + seats + flight time + plain-words notes, Fraunces 32px total price, "Choose this one" primary on the recommended row, secondary "Choose" on the others), "Prices include everything. Held until …".
  - booked: confirmation with where-to-go instructions.

### Member account — `Account.dc.html`

- Public header; layout `220px minmax(0,1fr)`; left rail: "Member account" label, name, email, 7 items with 13px descriptions (Overview highlighted), primary "Request a quote →", "Sign out →".
- Overview: h1 Fraunces 44px "Welcome back, Dana.", one-sentence summary; "Upcoming trip" card (`minmax(0,1fr) 200px`): Fraunces 32px route, sentence with date/time/duration, dl Aircraft / Where to go / Passengers (add names) / Status (● Confirmed · crew briefed), buttons Trip details / Add to calendar / Message dispatch, square aircraft photo; "Quotes · submitted & in progress" row with gold dot sentence and "Track →"; "Trips · past" list (route · date · aircraft, price, Invoice link); right column cards Membership (hours left + 6px progress bar + "Buy / top up"), Invoices ("Nothing outstanding"), Your dispatcher (avatar, "Dispatch open" in success, Call / Text / Email).
- Other sections reuse the same card grammar; no ids, no enum statuses.

### Admin (client desk) — sidebar Requests / Trips / Clients / Messages / Settings

**Requests** — `Admin - Requests.dc.html`
- h1 "Requests" + search (260px) + "+ New request"; tabs "Needs a reply · 2 / Working on it · 2 / Options sent · 1 / Booked · 1 / All" (underline style); grouped lists — each row grid `minmax(0,1fr) 220px auto`: **Name** 17px 500 + "· n passengers", trip sentence, optional note in steel; middle column "Received 12 min ago" + due line ("Reply due in 18 min", overdue in danger); right button "Open" (primary in Needs a reply, secondary elsewhere, "Nudge" for Options sent). Empty state "All caught up."
- Removed from the live inbox: TOTAL/NEW/SOURCING/PAST SLA counters, Ref, Pax and Category columns, failed-mail list, blog audience strip (the last two move to Settings › Connections / History).

**One request** — `Admin - Request.dc.html` (`min-width:1200px`)
- "← All requests"; h1 "Dana Whitfield · Los Angeles → Aspen" + sentence; right side: status pill sentence "Needs a reply · due in 18 min" + Call / Text / Email buttons.
- Stage strip (4 numbered stages: Add 2–3 options → Send to Dana → Dana picks one → Confirm booking → becomes a Trip; current has a gold ring).
- Three columns `230px minmax(320px,1fr) 260px`: The trip (dl with city first, airport in steel; Edit; client summary + "Client page ›"), Options to send (buttons "Open in Avinode ↗" and "Paste Avinode quote"; option rows with operator price → client price and markup %; dashed "Add a second option…" slot; primary "Send options to Dana →" enabled only with ≥2 options, hint text explains why), Conversation (bubbles: client left, staff right on `#161A20`, internal note on gold-tinted dashed card; composer with channel).
- Props: `optionsAdded` 0–3 (tweak) drives `canSend` / `needMore`.

**Trips** — `Admin - Trips.dc.html`: h1 + search; "Flying today · date" featured card with clearance border (route, times, aircraft, where to go, passengers, crew contact, buttons); groups "This week", "Later", "Past" with rows Route · date · client · aircraft · status sentence.

**Clients** — `Admin - Clients.dc.html`: h1 + search + primary "+ Invite a client"; three number cards (clients / flew in last 90 days / card members); table `1.4fr 1.2fr .8fr 1fr` Name · Flights · Total spent · Membership; 300px preview drawer (Call/Text/Email, Next flight, Good to know, Membership, "Open full client page").

**Messages** — `Admin - Messages.dc.html` (`min-width:1180px`): two panes — thread list (search, one row per client with channel icon, last line, time, unread dot) and conversation (header with client + Call/Text/Email, bubbles as on the request page, channel picker Text / Email / Call note, quick replies chips, composer).

**Settings** — `Admin - Settings.dc.html`: secondary left list Reports / Team / Notifications / Connections / History. Reports: period segmented (This week / This month / This year), three numbers (requests received, flights booked, revenue), "Where requests ended up" bars, Money dl. Team: rows with role select and remove. Notifications: toggle rows. Connections: Avinode, Stripe, Resend, Twilio, Cal — status + Manage. History: date + sentence rows.

### Mobile — `Mobile.dc.html`
Six iPhone frames (390×844): Home, Quote step 1, Quote step 2, Your request, Account, Admin Requests. Rules: 20px side padding, single column, hero h1 40px, search card fields stacked, aircraft categories in a horizontal scroll strip (scrollbar hidden), pinned footer with the primary button (Quote) or tab bar (Account / Admin: 5 tabs, 56px), all hit targets ≥ 44px, admin request rows show the due line first.

## Interactions & behaviour

- Segmented controls, chips, tabs and accordions: instant state change, no animation beyond `transition: background .15s, border-color .15s`.
- Accordions open one item at a time (`open` index; clicking the open one closes it).
- Quote: category cards disabled when `pax > seats` or `longest leg > range`; recommended = the smallest category that fits. Summary lines in collapsed sections always reflect current selection ("Catering: Standard", "None requested").
- Quote sidebar recomputes distance, flight time and price on every change; sticky on desktop, becomes a collapsed bar above the pinned Continue button on mobile.
- Draft autosave: footer text "Step n of 4 · Saved" / "Draft saves automatically".
- Contact page clock ticks every 30 s in `America/Los_Angeles`.
- FAQ search filters as you type and resets the topic to "All topics".
- Empty legs filter chips filter rows; "Next 48 hours" uses `hours <= 48`.
- Admin request: "Send options" disabled until 2 options; sending moves the request to "Options sent" and posts to the client's thread; confirming a booking creates a Trip and removes the request from the Requests tabs.
- Hover: primary buttons lighten to `#F4F1EA`; secondary buttons border → `#8A9099`; card links lift border to `#2C323B`. Focus rings `0 0 0 2px #E8E2D2` offset 2px.
- Responsive: public pages reflow to one column below 900px; admin is desktop-only (≥1100px) except the Requests list which has a mobile layout.

## State & data

- Quote store (existing `quote-store.ts`): add `trip`, `legs[]`, `pax`, `category`, `cabin`, `catering`, `ground`, `extras`, `notes`, `contact`, `methods`, `bestTime`, `source`, `consent`. Keep the existing 4 routes (`/quote/mission|aircraft|contact|review`).
- Request status mapping for the desk: `submitted → Needs a reply`, `triaged|sourcing → Working on it`, `options_sent|held → Options sent`, `accepted|converted → Booked`. Store the enum, render the sentence.
- Due timer: `reply due = received + 30 min` during operating hours; show "Reply due in n min" or "Reply overdue by n min".
- Empty legs board: `legs[] {day,time,from,to,airports,duration,aircraft,category,seats,price,was,off,region,hours}`.
- FAQ: reuse `faq.ts`; search over question + answer.

## Assets (all copied from the repo's `public/images/`)

`brand/wordmark-bone.webp` · `hero/runway-night.webp, aircraft.webp, memberships.webp, how-it-works.webp, about.webp, safety.webp` · `programs/tarmac-dusk.webp, black-card.webp, reposition-sector.webp` · `fleet/turboprop.webp, light.webp, midsize.webp, supermid.webp, heavy.webp, ultra.webp` · `discretion/tail-night.webp` · `about/dispatch-room.webp`.
Founder and team photos are placeholders (initials) — supply real images. Icons: none required beyond `→ ↗ ✓ ⌕ + −` glyphs; use the codebase's icon set if preferred.

## Files in this bundle

Public: `Home.dc.html`, `Aircraft.dc.html`, `Memberships.dc.html`, `How it works.dc.html`, `Contact.dc.html`, `About.dc.html`, `FAQ.dc.html`, `Empty legs.dc.html`, `Safety.dc.html`, `Blog.dc.html`, `Legal.dc.html`, shared chrome `jn-chrome.js`.
Quote & client: `Quote.dc.html`, `Your request.dc.html`, `Account.dc.html`.
Admin: `Admin - Requests.dc.html`, `Admin - Request.dc.html`, `Admin - Trips.dc.html`, `Admin - Clients.dc.html`, `Admin - Messages.dc.html`, `Admin - Settings.dc.html`.
Mobile: `Mobile.dc.html` (+ `ios-frame.jsx` used by it).
Reference only: `Current - *.dc.html` (live screens as built), `Wireframes.dc.html`, `Plan my flight.dc.html`, `My flights.dc.html`.
Runtime: `support.js` is the prototype renderer the `.dc.html` files need to open in a browser; ignore it for implementation.
