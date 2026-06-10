"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs, type NewQuote, type NewQuoteLeg } from "@/db/schema/quotes";
import { findAirport } from "@/lib/airports";
import { toE164 } from "@/lib/phone";
import type { QuoteDraft } from "@/lib/quote-store";
import { getCurrentUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  sendDispatchNewQuoteNotification,
  sendQuoteAcknowledgmentEmail,
} from "@/lib/email";

export type SubmitResult =
  | { ok: true; ref: string; id: string; deduped?: true }
  | { ok: false; error: string; retryAfterMs?: number };

// Limits chosen to be generous for real users (one party rarely submits
// more than 2-3 quotes in five minutes) and tight enough to throttle a
// runaway form bot before it spams dispatch alerts.
const QUOTE_RATE_LIMIT_MAX = 5;
const QUOTE_RATE_LIMIT_WINDOW_SECONDS = 300;

/**
 * Insert a quote (and its legs) submitted from the public wizard.
 *
 * Signed-in visitors get their member record linked at insert (session
 * is the identity proof — see the IDOR note in convertQuoteToTrip);
 * anonymous visitors land as GUEST quotes a dispatcher can attach later.
 * RLS note: the quotes_anon_insert policy constrains the anon REST path
 * (member_id null, wizard/homepage/empty_leg source, consents true);
 * this Server Action writes through the pooled DATABASE_URL connection.
 */
export async function submitQuote(draft: QuoteDraft): Promise<SubmitResult> {
  // Server-side validation guard — never trust the client.
  if (draft.legs.length === 0) return { ok: false, error: "MISSING_LEGS" };
  if (draft.pax < 1 || draft.pax > 19) return { ok: false, error: "PAX_OUT_OF_RANGE" };
  if (!draft.consent.broker || !draft.consent.contact) {
    return { ok: false, error: "MISSING_CONSENT" };
  }
  if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.email.trim()) {
    return { ok: false, error: "MISSING_CONTACT" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
    return { ok: false, error: "INVALID_EMAIL" };
  }
  if (draft.notes && draft.notes.length > 800) {
    return { ok: false, error: "NOTES_TOO_LONG" };
  }
  // Floor the depart date at "today, anywhere on earth" (UTC-12). The
  // wizard collects local dates with no timezone, so a strict UTC-today
  // floor would wrongly reject a late-evening Hawaii booking for "today";
  // the AoE floor never rejects a legitimate same-day mission while still
  // blocking genuinely past dates.
  const minDate = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const l of draft.legs) {
    if (!l.fromIata || !l.toIata || !l.date || !l.time) {
      return { ok: false, error: "INCOMPLETE_LEG" };
    }
    if (l.date < minDate) {
      return { ok: false, error: "DATE_IN_PAST" };
    }
  }

  // Extract client IP up-front so it's available for rate-limit + audit.
  let clientIp = "unknown";
  try {
    const hdrs = await headers();
    clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  } catch {
    // headers() can throw outside a request scope; allow the action to
    // proceed without rate-limiting in that case (e.g. unit tests).
  }

  // Rate limit anonymous quote submissions per IP. Failing-open inside the
  // limiter library means a DB hiccup never blocks a real user.
  if (clientIp !== "unknown") {
    const rl = await checkRateLimit(`quote_submit:${clientIp}`, {
      max: QUOTE_RATE_LIMIT_MAX,
      windowSeconds: QUOTE_RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rl.ok) {
      return { ok: false, error: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs };
    }
  }

  // Idempotency — if the client retries with the same key (network drop,
  // double-click after a slow response), short-circuit to the existing row
  // instead of creating a duplicate quote.
  const idempotencyKey = draft.clientIdempotencyKey?.trim() || null;
  if (idempotencyKey) {
    try {
      const existing = await db
        .select({ id: quotes.id, quoteCode: quotes.quoteCode })
        .from(quotes)
        .where(eq(quotes.clientIdempotencyKey, idempotencyKey))
        .limit(1);
      if (existing.length > 0) {
        return {
          ok: true,
          ref: existing[0].quoteCode,
          id: existing[0].id,
          deduped: true,
        };
      }
    } catch (err) {
      // Lookup failure shouldn't block the submit; we'll fall through to
      // insert and let the unique index catch a true duplicate below.
      console.error("idempotency lookup failed", err);
    }
  }

  // Smoke-test guard: production-smoke Playwright submits a real quote
  // through the wizard, but we don't want it to wake dispatch, count
  // against SLA, or clutter the inbox. A first-name prefix of [SMOKE]
  // marks the submission as automated — we honor the insert (so the
  // smoke can assert against DB state) but flip status='cancelled' +
  // skip both ack and dispatch-notification emails.
  const isSmoke = draft.firstName.trim().startsWith("[SMOKE]");

  // Link the member when the visitor is signed in — the SESSION is the
  // proof of identity, never the typed email (binding by contact email
  // at convert-time was an IDOR; see convertQuoteToTrip). Without this
  // link the quote lands as GUEST and convert-to-trip is gated until a
  // dispatcher attaches a member by hand. Lookup failure degrades to an
  // anonymous submit — the quote still lands.
  let memberId: string | null = null;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
    if (user) {
      const m = await getMemberByUserId(user.id);
      memberId = m?.id ?? null;
    }
  } catch (err) {
    console.error("submitQuote auth lookup failed — treating as anon", err);
  }

  try {
    const inserted = await db.transaction(async (tx) => {
      const values: NewQuote = {
          // quote_code is auto-filled by the quotes_default_quote_code trigger.
          memberId,
          createdByUserId: user?.id ?? null,
          source: "quote_wizard",
          tripType:
            draft.tripType === "roundtrip"
              ? "round"
              : draft.tripType === "oneway"
                ? "one_way"
                : "multi_leg",
          paxCount: draft.pax,
          childrenCount: draft.kids,
          petsCount: draft.pets,
          extraBagsCount: draft.bags,

          // Wizard uses "ultra" (matches the URL slug); DB enum uses "ulr".
          requestedCategory: draft.category === "ultra" ? "ulr" : draft.category,
          cabinPrefs: draft.cabin,
          cateringTier: draft.catering === "custom" ? "custom" : draft.catering,
          // Wizard uses "suv"; DB enum uses "suv_sprinter".
          groundOption: draft.ground === "suv" ? "suv_sprinter" : draft.ground,
          notes: draft.notes || null,

          contactMethods: draft.methods,
          bestTime: draft.bestTime,
          referralSource: draft.source,

          contactSnapshot: {
            firstName: draft.firstName,
            lastName: draft.lastName,
            email: draft.email,
            // Normalize at intake — the wizard collects the phone in
            // national format and the country dial code separately,
            // so storing them verbatim under the misleading
            // `phoneE164` name produces "+1(818) 800-5678" downstream
            // (Twilio rejects 21211). Store the canonical E.164.
            phoneE164: toE164(draft.phone, draft.phoneCountry) ?? draft.phone,
            phoneCountry: draft.phoneCountry,
            company: draft.company,
            account: draft.account,
          },

          consentBroker: draft.consent.broker,
          consentContact: draft.consent.contact,
          consentMarketing: draft.consent.marketing,

          clientIdempotencyKey: idempotencyKey,

          status: isSmoke ? "cancelled" : "submitted",
      };
      const [row] = await tx
        .insert(quotes)
        .values(values)
        .returning({ id: quotes.id, quoteCode: quotes.quoteCode });

      const legRows: NewQuoteLeg[] = draft.legs.map((l, i) => {
        const from = l.fromIata ? findAirport(l.fromIata) : null;
        const to = l.toIata ? findAirport(l.toIata) : null;
        return {
          quoteId: row.id,
          legNumber: i + 1,
          fromIcao: from?.icao ?? null,
          fromIata: l.fromIata ?? null,
          fromCity: l.fromCity ?? null,
          fromName: l.fromName ?? null,
          toIcao: to?.icao ?? null,
          toIata: l.toIata ?? null,
          toCity: l.toCity ?? null,
          toName: l.toName ?? null,
          departDate: l.date ?? null,
          departTime: l.time ?? null,
          distanceNm: l.distanceNm ?? null,
        };
      });

      if (legRows.length > 0) {
        await tx.insert(quoteLegs).values(legRows);
      }

      return row;
    });

    await logAudit({
      actorUserId: user?.id ?? null,
      actorRole: user?.role ?? "anon",
      action: "quote.submit",
      subjectType: "quote",
      subjectId: inserted.id,
      subjectCode: inserted.quoteCode,
      metadata: {
        tripType: draft.tripType,
        paxCount: draft.pax,
        legs: draft.legs.length,
        category: draft.category,
        contactEmail: draft.email,
        memberId: memberId ?? undefined,
        source: "quote_wizard",
      },
    });

    // Bust any cached admin views so the new quote shows up on the desk.
    revalidatePath("/admin/dispatch");

    // Smoke-test submissions skip both ack + dispatch notification so
    // they don't generate noise in inboxes on every deploy. The DB row
    // is still there for the smoke runner to assert against.
    if (isSmoke) {
      return { ok: true, ref: inserted.quoteCode, id: inserted.id };
    }

    // Fire-and-forget delivery — never block the user's submit response on
    // SMTP being awake. The email layer no-ops gracefully without an API key.
    try {
      const hdrs = await headers();
      const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
      const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
      const workbenchUrl = `${baseUrl}/admin/quote/${inserted.id}`;

      const legSummaries = draft.legs.map((l) => ({
        fromIata: l.fromIata ?? null,
        toIata: l.toIata ?? null,
        date: l.date ?? null,
      }));

      const [ack, notif] = await Promise.allSettled([
        sendQuoteAcknowledgmentEmail({
          quoteCode: inserted.quoteCode,
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone: draft.phone,
          legs: legSummaries,
          paxCount: draft.pax,
        }),
        sendDispatchNewQuoteNotification({
          quoteCode: inserted.quoteCode,
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone: draft.phone,
          legs: legSummaries,
          paxCount: draft.pax,
          workbenchUrl,
        }),
      ]);

      // Audit the delivery outcome — best-effort metadata so dispute
      // arbitration knows whether dispatch was actually pinged.
      const summarize = (
        r: PromiseSettledResult<Awaited<ReturnType<typeof sendQuoteAcknowledgmentEmail>>>,
      ) => {
        if (r.status === "rejected") return { status: "rejected" as const, error: String(r.reason) };
        if (!r.value.ok) return { status: "error" as const, error: r.value.error };
        return {
          status: "ok" as const,
          provider: r.value.provider,
          messageId: r.value.messageId ?? null,
        };
      };
      await logAudit({
        actorUserId: null,
        actorRole: "system",
        action: "quote.notify.email",
        subjectType: "quote",
        subjectId: inserted.id,
        subjectCode: inserted.quoteCode,
        metadata: {
          acknowledgment: summarize(ack),
          dispatchNotification: summarize(notif),
        },
      });
    } catch (err) {
      // Email is best-effort — never propagate to the user.
      console.error("submitQuote email side-effect failed", err);
    }

    return { ok: true, ref: inserted.quoteCode, id: inserted.id };
  } catch (err) {
    // Unique-violation on client_idempotency_key — a parallel submit
    // already created the row. Look it up and return it as a dedupe hit.
    if (
      idempotencyKey &&
      err instanceof Error &&
      /quotes_client_idempotency_key_uq|duplicate key/i.test(err.message)
    ) {
      try {
        const existing = await db
          .select({ id: quotes.id, quoteCode: quotes.quoteCode })
          .from(quotes)
          .where(eq(quotes.clientIdempotencyKey, idempotencyKey))
          .limit(1);
        if (existing.length > 0) {
          return {
            ok: true,
            ref: existing[0].quoteCode,
            id: existing[0].id,
            deduped: true,
          };
        }
      } catch (lookupErr) {
        console.error("idempotency post-conflict lookup failed", lookupErr);
      }
    }
    console.error("submitQuote failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}
