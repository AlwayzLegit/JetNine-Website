# End-to-end QA script

Two halves. The **automated half** runs from any machine with the repo
(`pnpm build`, the audits in `scripts/`, Playwright). The **signed-in half**
below needs a browser on the live site and runs on the owner's computer.
Record results in a copy of the checklist at the bottom; every failure gets
a line with the page, what happened and a screenshot.

Conventions used here:
- `QA_EMAIL` and `QA_PHONE`: the inbox and mobile the tester controls. Never
  commit them to this file.
- QA requests use the first name **QA Tester** so they show on the desk.
  (First names starting with `[SMOKE]` are hidden from the Requests list;
  don't use that here.)
- Expected outcomes are in *italics*. Anything else is a defect.
- Side effects (rows, emails, texts, History lines) are checked from the
  cloud session through Supabase, Resend, Twilio and PostHog; say "ready"
  in chat at each **checkpoint** and wait for the OK before moving on.

## 0. Before you start

1. Production is on the commit you are testing: Vercel › Deployments shows
   READY for `main`.
2. A fresh browser profile or a private window, so no stale sessions.
3. Phone width (390 px) is checked with the browser's device toolbar on
   the pages marked **[mobile]**.

## 1. Public site (visual pass on the live site)

The automated crawl checks status codes, titles, metadata and console
errors. Here you look.

1. `/` **[mobile]**: hero, quote launcher, the three paths, footer links.
   *No overlap, no clipped text, menu opens and closes on mobile.*
2. `/aircraft` and one category (`/aircraft/midsize`) **[mobile]**.
3. `/memberships`, `/how-it-works`, `/about`, `/safety`, `/faq`, `/contact`.
4. `/empty-legs` **[mobile]**: board renders (or "nothing listed" if empty).
   Subscribe to a watchlist with `QA_EMAIL` and `QA_PHONE`.
   *Confirmation email arrives; the link confirms; the text opt-in arrives.*
   **Checkpoint A.**
5. `/blog` and today's post **[mobile]**: hero image, table of contents,
   FAQ accordion, related posts.
6. `/privacy`, `/terms`.
7. Contact form on `/contact`: send one message as QA Tester.
   *Thank-you state; it appears later under Messages › Website form.*

## 2. Client round trip, part 1: the request

1. `/quote` **[mobile]**: step 1 trip, step 2 passengers and dates, step 3
   contact (first name **QA Tester**, `QA_EMAIL`, `QA_PHONE`), step 4 review
   and send. *Back/next keep values; validation messages are plain words.*
2. After sending: *confirmation page with the reply promise ("within 30
   minutes" unless Settings › Notifications changed it) and a link to
   "Your request".*
3. `QA_EMAIL`: *acknowledgement email with the same promise and the status
   link.* `QA_PHONE`: *acknowledgement text.*
4. Open the status link `/request/<token>` **[mobile]**: *status "Received",
   the promise, the trip summary.* Change the last character of the token:
   *404 page.*
   **Checkpoint B** (quote row, token, ack email + text, PostHog
   `quote_submitted`).

## 3. Admin desk

Sign in at `/sign-in` as an owner.

### Requests
1. `/admin/requests` **[mobile]**: the QA request is in "Needs a reply" with
   a due time. Search by "QA" finds it. Tabs switch without reload errors.
2. Open it. *Header shows status, due time, contact buttons (Call / Text /
   Email).*
3. Assign it to yourself. Set status to Triaged. *History sentence appears
   in Settings › History.*
4. Add two options (aircraft, price, notes). Edit one. Delete and re-add.
5. **Send options**. *Client gets an email (and text if enabled) with the
   status link; status becomes Options sent; the due timer clears.*
6. On the status page as the client **[mobile]**: *both options shown;
   choose one.* *Desk shows the choice; status Accepted.*
7. Put the request on **Hold** and release it. *Client emailed on hold.*
8. Messages on the request: send an email and a text from the thread; add a
   call note. *Both deliver; the note is internal only.*
   Reply to the email from `QA_EMAIL`. *Reply shows in the thread within a
   minute and in Messages › Unread.*
   **Checkpoint C.**

### Convert to a trip
9. Confirm the booking (convert). *Trip created with code; request shows
   "Converted" with a link; invoice drafted.*
10. `/admin/trips` **[mobile]**: trip under Upcoming. Open it. Edit the
    schedule. Set status Confirmed. *Client notified.*
11. Invoice: finalize, mark paid (or test Stripe flow if test keys are on).
    *Invoice status updates; History records it.*
12. Cancel the trip (last). *Refund path runs or is skipped cleanly; client
    texted; status Cancelled.*
    **Checkpoint D.**

### Clients
13. `/admin/clients`: invite the QA client with `QA_EMAIL`. *Invite email
    arrives.* Link the client to the QA request. Open the client page:
    *request, trip, invoice, messages all listed; preferences editable.*

### Messages
14. `/admin/messages` **[mobile]**: tabs All / Unread / Call notes /
    Website form / Problems. The contact-form message from step 1.7 is
    under Website form; mark it handled. Mark the email reply read.
    Problems tab: *empty, or lists a failed delivery with a Retry that
    works.*

### Settings
15. Reports: period switcher; export CSV downloads.
16. Team: list shows you as Owner. (Do not invite real people here.)
17. Notifications: toggle the morning summary on and off; change the reply
    promise to 45 minutes and back to 30. *Each change is in History.*
18. Connections: every service shows its state; "Send a test email" lands
    in your inbox.
19. **API keys**: create a *Read only* key. *Shown once; Copy works.*
    Create a *Daily assistant* key. *"asks first" is on and can't be turned
    off.* Both keys listed with "Never used".
    From a terminal on this computer:
    - `curl -s https://jetnine.com/api/v1/me -H "Authorization: Bearer <read key>"` → *200, scopes = read.*
    - `curl -s -X POST https://jetnine.com/api/v1/blog/posts -H "Authorization: Bearer <read key>" -H "Content-Type: application/json" -d '{}'` → *403 forbidden.*
    - With the assistant key, create a draft post, read it, update it,
      then `DELETE` it → *201, 200, 200, then 403 "asks before acting".*
    - Delete that draft with the legacy env key or from the DB at
      Checkpoint E.
    Reload the page: *last used time and IP shown, calls counted.*
    Revoke both keys with a reason. *They move under "Revoked and expired";
    `/me` with either now returns 401.*
    **Checkpoint E** (api_keys rows, api_requests rows, History lines
    "created the API key", audit rows for the blog draft).
20. History: today's actions read as sentences with links that resolve.
21. Reference data: open operators, aircraft, airports, ops, empty legs.
    Edit one airport's FBO note and revert it.

### Empty legs and watchlists
22. Reference data › Empty legs: create a draft leg matching the watchlist
    from 1.4 (same route or region). Set it live. *`QA_PHONE` gets the
    watchlist text within a minute; the leg shows on `/empty-legs`.*
    Mark it sold, then delete it.
    **Checkpoint F.**

## 4. Member account

1. Open the invite link from step 13 as the client **[mobile]**.
   *Signed in; `/account` overview shows the QA trip and invoice.*
2. Walk the sections: Quotes, Trips, Invoices, Memberships, Preferences,
   travellers. *Each loads; preferences save; an in-app message from the
   desk (send one from the request thread as "in-app") shows here.*
3. Sign out. `/account` *redirects to sign-in.*

## 5. Cleanup (cloud session)

Delete the QA quote, options, trip, invoice, messages, inquiry, watchlist,
empty leg, member and auth user; confirm both API keys revoked and the API
test draft removed. Keep the History rows.

## Checklist

| # | Area | Result | Notes |
|---|------|--------|-------|
| 1 | Public pages | | |
| 2 | Quote → status page | | |
| 3a | Requests, options, hold, messages | | |
| 3b | Trip, invoice, cancel | | |
| 3c | Clients | | |
| 3d | Messages | | |
| 3e | Settings incl. API keys | | |
| 3f | Empty legs + watchlist text | | |
| 4 | Member account | | |
| 5 | Cleanup | | |
