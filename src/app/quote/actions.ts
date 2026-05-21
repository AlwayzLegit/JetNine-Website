"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { quotes, quoteLegs, type NewQuote, type NewQuoteLeg } from "@/db/schema/quotes";
import { findAirport } from "@/lib/airports";
import type { QuoteDraft } from "@/lib/quote-store";

export type SubmitResult =
  | { ok: true; ref: string; id: string }
  | { ok: false; error: string };

/**
 * Insert a quote (and its legs) submitted from the public wizard.
 *
 * RLS treats the SECURITY DEFINER path: this Server Action runs under the
 * anon Supabase context (via DATABASE_URL connection pool). The
 * quotes_anon_insert policy permits insert as long as member_id is null,
 * created_by_user_id is null, source is wizard/homepage/empty_leg, and
 * both required consents are true.
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
  for (const l of draft.legs) {
    if (!l.fromIata || !l.toIata || !l.date || !l.time) {
      return { ok: false, error: "INCOMPLETE_LEG" };
    }
  }

  try {
    const inserted = await db.transaction(async (tx) => {
      const values: NewQuote = {
          // quote_code is auto-filled by the quotes_default_quote_code trigger.
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
            phoneE164: draft.phone,
            phoneCountry: draft.phoneCountry,
            company: draft.company,
            account: draft.account,
          },

          consentBroker: draft.consent.broker,
          consentContact: draft.consent.contact,
          consentMarketing: draft.consent.marketing,

          status: "submitted",
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

    // Bust any cached admin views so the new quote shows up on the desk.
    revalidatePath("/admin/dispatch");

    return { ok: true, ref: inserted.quoteCode, id: inserted.id };
  } catch (err) {
    console.error("submitQuote failed", err);
    return { ok: false, error: "DB_INSERT_FAILED" };
  }
}
