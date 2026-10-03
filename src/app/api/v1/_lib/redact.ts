/**
 * What leaves the API, per permission. The loaders return what the admin
 * pages need; these helpers trim that for a key before it is serialized.
 *
 *  - Secrets and tokens never leave: a request's status token (it is the
 *    bearer for the public status page), idempotency keys, Stripe ids,
 *    recording links.
 *  - Internal notes never leave (dispatcher / invoice / membership notes).
 *  - Money leaves only with the `money` permission: any field ending in
 *    `Usd`, margins, and the dollar amounts inside plain-word lines.
 *  - Staff email addresses never leave as labels; "Desk" stands in.
 */

export function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

/** "Paid · $12,000" → "Paid · —" */
export function hideAmounts<T extends string | null | undefined>(s: T): T {
  return (typeof s === "string" ? s.replace(/\$\s?[\d,]+(?:\.\d+)?[kKmM]?/g, "—") : s) as T;
}

/** Drop every `…Usd` field and the margin percentage. */
export function dropMoney<T extends object>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const k of Object.keys(out)) {
    if (/Usd$/.test(k) || k === "marginPct") delete out[k];
  }
  return out as T;
}

const QUOTE_SECRET = ["statusToken", "clientIdempotencyKey", "slaAlertedAt"] as const;

export function redactQuote<T extends object>(quote: T, money: boolean): T {
  const out = omit(quote, QUOTE_SECRET as unknown as (keyof T)[]) as T;
  return money ? out : dropMoney(out);
}

const INVOICE_INTERNAL = [
  "stripeCheckoutSessionId",
  "stripePaymentIntentId",
  "notes",
  "dueReminderSentAt",
  "overdueNotifiedAt",
] as const;

export function redactInvoice<T extends object>(inv: T, money: boolean): T {
  const out = omit(inv, INVOICE_INTERNAL as unknown as (keyof T)[]) as T;
  return money ? out : dropMoney(out);
}

const MEMBERSHIP_INTERNAL = ["stripeCheckoutSessionId", "stripePaymentIntentId", "notes"] as const;

export function redactMembership<T extends object>(m: T, money: boolean): T {
  const out = omit(m, MEMBERSHIP_INTERNAL as unknown as (keyof T)[]) as T;
  return money ? out : dropMoney(out);
}

/** A sender label that is an email address belongs to a teammate; the API says "Desk". */
export function deskLabel<T extends string | null | undefined>(label: T): T {
  return (typeof label === "string" && label.includes("@") ? "Desk" : label) as T;
}

export function redactMessages<T extends { fromLabel: string | null }>(messages: T[]): T[] {
  return messages.map((m) => ({ ...m, fromLabel: deskLabel(m.fromLabel) }));
}
