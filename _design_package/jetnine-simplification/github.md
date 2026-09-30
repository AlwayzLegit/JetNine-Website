repo: AlwayzLegit/JetNine-Website
branch: main
path: src

## Last sync
date: 2026-09-30T18:40:00Z

### Updated in this project
- Body typeface switched from Inter to Instrument Sans across all 21 screens and the shared chrome
- Detailed QA pass over all 21 screens: removed remaining jargon (airframe, FBO, CONUS, ULR, "people"), fixed admin request page fit at 1200px, thin scrollbars, mobile label + padding fixes
- Handoff package written to design_handoff_jetnine_simplification/ (README + all design files)
- Last public pages simplified: FAQ (search + topics), Empty legs (board + watchlist), Safety, Blog & guides, Legal
- Remaining public pages simplified: Aircraft, Programs/Memberships, How it works, Contact, About (shared header/footer in jn-chrome.js)
- Admin Messages (one thread per client: texts, emails, call notes) and a Mobile pass (6 phone screens)
- Admin Trips, Clients and Settings (reports, team, notifications, connections, history) in the 5-section desk
- Realigned hi-fi to the live site flow and copy: Home (all live sections), Quote (4 steps), Account (7 sections)
- Hi-fi simplified screens: Your request, Admin Requests, Admin Request; earlier one-page variants kept as Plan my flight / My flights
- Recreated 4 baseline screens as built: Home, Quote step 1, Member account, Admin inbox
- Copied brand wordmark, hero, program, fleet and discretion images
- Round-1 simplification wireframes for public site, quote flow, account and admin

## Screen map
| Screen | Repo files |
|---|---|
| Current - Home.dc.html | src/app/(marketing)/layout.tsx, src/app/(marketing)/page.tsx, src/components/site-nav.tsx, src/components/site-footer.tsx, src/components/brand-mark.tsx, src/components/home/*.tsx, src/components/placeholder.tsx, src/lib/constants.ts, src/lib/fleet.ts, src/app/globals.css, tailwind.config.ts |
| Current - Quote Step 1.dc.html | src/app/quote/layout.tsx, src/app/quote/mission/page.tsx, src/components/quote/quote-nav.tsx, src/components/quote/stepper.tsx, src/components/quote/mission-sidebar.tsx, src/components/quote/airport-input.tsx, src/components/quote/saved-indicator.tsx, src/lib/quote-store.ts, src/app/globals.css |
| Current - Account.dc.html | src/app/account/layout.tsx, src/app/account/page.tsx, src/components/site-nav.tsx, src/components/site-footer.tsx, src/app/globals.css |
| Current - Admin Inbox.dc.html | src/app/admin/layout.tsx, src/components/admin/admin-shell.tsx, src/components/admin/admin-nav.tsx, src/app/admin/dispatch/page.tsx, src/components/admin/failed-delivery-list.tsx, src/app/globals.css |
| Home.dc.html | src/app/(marketing)/page.tsx, src/components/home/*.tsx, src/components/site-nav.tsx, src/components/site-footer.tsx, src/lib/fleet.ts, src/lib/constants.ts |
| Quote.dc.html | src/app/quote/mission/page.tsx, src/app/quote/aircraft/page.tsx, src/app/quote/contact/page.tsx, src/app/quote/review/page.tsx, src/components/quote/quote-sidebar.tsx, src/components/quote/stepper.tsx, src/lib/fleet.ts |
| Account.dc.html | src/app/account/page.tsx, src/app/account/trips/page.tsx, src/app/account/quotes/page.tsx, src/app/account/invoices/page.tsx, src/app/account/memberships/page.tsx |
| Plan my flight.dc.html | src/app/quote/mission/page.tsx, src/app/quote/contact/page.tsx, src/components/quote/mission-sidebar.tsx, src/lib/quote-store.ts |
| Your request.dc.html | src/app/quote/review/page.tsx, src/app/account/quotes/page.tsx |
| My flights.dc.html | src/app/account/page.tsx, src/app/account/trips/page.tsx, src/app/account/membership/page.tsx |
| Admin - Requests.dc.html | src/app/admin/dispatch/page.tsx, src/components/admin/admin-nav.tsx |
| Admin - Request.dc.html | src/app/admin/dispatch/[id]/page.tsx, src/app/admin/workbench/page.tsx |
| Admin - Trips.dc.html | src/app/admin/trips/*, src/app/admin/live-ops/* (flying-today card), RBAC.md |
| Admin - Clients.dc.html | src/app/admin/member/page.tsx, src/app/admin/members/*, RBAC.md |
| Admin - Settings.dc.html | src/app/admin/reports/page.tsx, src/app/admin/audit/*, src/app/admin/health/*, src/app/admin/voice/*, src/app/admin/ai/*, RBAC.md |
| Admin - Messages.dc.html | src/app/admin/dispatch/page.tsx (failed deliveries), src/components/admin/failed-delivery-list.tsx, src/app/admin/voice/*, src/app/admin/inquiries/* |
| Mobile.dc.html | src/app/(marketing)/page.tsx, src/app/quote/*, src/app/account/page.tsx, src/app/admin/dispatch/page.tsx |
| Aircraft.dc.html | src/app/(marketing)/aircraft/page.tsx, src/lib/fleet.ts |
| Memberships.dc.html | src/app/(marketing)/memberships/page.tsx, src/lib/rates.ts |
| How it works.dc.html | src/app/(marketing)/how-it-works/page.tsx, src/lib/rates.ts |
| Contact.dc.html | src/app/(marketing)/contact/page.tsx, src/components/contact-form.tsx, src/lib/constants.ts |
| About.dc.html | src/app/(marketing)/about/page.tsx |
| FAQ.dc.html | src/app/(marketing)/faq/page.tsx, src/lib/faq.ts |
| Empty legs.dc.html | src/app/(marketing)/empty-legs/page.tsx |
| Safety.dc.html | src/app/(marketing)/safety/page.tsx |
| Blog.dc.html | src/app/(marketing)/blog/page.tsx, src/app/(marketing)/guides/page.tsx, src/lib/guides.ts |
| Legal.dc.html | src/app/(marketing)/legal/page.tsx |
| jn-chrome.js | src/components/site-nav.tsx, src/components/site-footer.tsx |
| Wireframes.dc.html | README.md, RBAC.md, src/lib/constants.ts, src/components/admin/admin-nav.tsx, src/app/account/page.tsx, src/app/admin/member/page.tsx, src/app/account/trips/page.tsx |
