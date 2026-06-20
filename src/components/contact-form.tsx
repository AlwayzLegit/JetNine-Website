"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitContactInquiry } from "@/app/(marketing)/contact/actions";
import { track } from "@/lib/analytics";

type FieldName = "first" | "last" | "email" | "mobile" | "from" | "to" | "date" | "pax" | "notes";
type Reason = "quote" | "card" | "trip" | "other";

const REASONS: { id: Reason; label: string }[] = [
  { id: "quote", label: "Quote a flight" },
  { id: "card", label: "Card / Reserve" },
  { id: "trip", label: "Existing trip" },
  { id: "other", label: "Other" },
];

// Trip fields are only mandatory when the visitor is asking for a quote —
// a Card question or a general note has no route to declare.
const ALWAYS_REQUIRED: FieldName[] = ["first", "last", "email"];
const QUOTE_REQUIRED: FieldName[] = ["from", "to", "date"];

type Errors = Partial<Record<FieldName, true>>;

export function ContactForm() {
  const [reason, setReason] = useState<Reason>("quote");
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    // Cheap client-side check so obvious misses don't round-trip to the
    // server. The Server Action repeats the validation.
    const data = new FormData(e.currentTarget);
    const next: Errors = {};
    const required =
      reason === "quote" ? [...ALWAYS_REQUIRED, ...QUOTE_REQUIRED] : ALWAYS_REQUIRED;
    for (const k of required) {
      if (!(data.get(k) as string | null)?.trim()) next[k] = true;
    }
    const email = (data.get("email") as string)?.trim() ?? "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = true;

    if (Object.keys(next).length) {
      setErrors(next);
      setMsg({
        tone: "error",
        text: `CHECK — ${Object.keys(next).join(", ").toUpperCase()}`,
      });
      return;
    }
    setErrors({});
    const form = e.currentTarget;
    startTransition(async () => {
      const result = await submitContactInquiry(data);
      if (result.ok) {
        setMsg({
          tone: "ok",
          text: `CLEARED — ${result.message} (${reason.toUpperCase()})`,
        });
        track("contact_inquiry_submitted", { reason });
        form.reset();
        setReason("quote");
      } else if (result.error === "RATE_LIMITED") {
        setMsg({
          tone: "error",
          text: "TOO MANY SENDS — WAIT A FEW MINUTES OR CALL DISPATCH",
        });
      } else {
        setMsg({ tone: "error", text: `NOT SENT — ${result.error}` });
      }
    });
  }

  // Suffix shown on trip-field labels when they're not mandatory for the
  // selected reason.
  const tripOptional = reason !== "quote";

  return (
    <form noValidate onSubmit={onSubmit} className="relative flex flex-col gap-3">
      {/* Honeypot — humans never see it, autofill bots fill everything.
          The server silently drops submissions that include it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="cf-company">Company</label>
        <input id="cf-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={`field-jn ${errors.first ? "error" : ""}`}>
          <label htmlFor="cf-first">First name</label>
          <input id="cf-first" name="first" type="text" placeholder="Alex" autoComplete="given-name" required aria-invalid={errors.first || undefined} />
        </div>
        <div className={`field-jn ${errors.last ? "error" : ""}`}>
          <label htmlFor="cf-last">Last name</label>
          <input id="cf-last" name="last" type="text" placeholder="Morgan" autoComplete="family-name" required aria-invalid={errors.last || undefined} />
        </div>
        <div className={`field-jn ${errors.email ? "error" : ""}`}>
          <label htmlFor="cf-email">Email</label>
          <input id="cf-email" name="email" type="email" placeholder="m.aldrich@example.com" autoComplete="email" required aria-invalid={errors.email || undefined} />
        </div>
        <div className={`field-jn ${errors.mobile ? "error" : ""}`}>
          <label htmlFor="cf-mobile">Mobile</label>
          <input id="cf-mobile" name="mobile" type="tel" placeholder="+1 (818) 555-0142" autoComplete="tel" aria-invalid={errors.mobile || undefined} />
        </div>
      </div>

      <fieldset className="rounded-[2px] border-b border-steel bg-ink-3 px-4 py-4">
        <legend className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
          Reason for contact
        </legend>
        <input type="hidden" name="reason" value={reason} />
        <div className="mt-3 flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              className={[
                "rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                reason === r.id
                  ? "border-clearance bg-clearance text-ink"
                  : "border-ink-4 text-bone-2 hover:border-bone-2 hover:text-bone",
              ].join(" ")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={`field-jn ${errors.from ? "error" : ""}`}>
          <label htmlFor="cf-from">Departing{tripOptional ? " · optional" : ""}</label>
          <input id="cf-from" name="from" type="text" placeholder="Los Angeles, KVNY" aria-invalid={errors.from || undefined} />
        </div>
        <div className={`field-jn ${errors.to ? "error" : ""}`}>
          <label htmlFor="cf-to">Arriving{tripOptional ? " · optional" : ""}</label>
          <input id="cf-to" name="to" type="text" placeholder="New York, KTEB" aria-invalid={errors.to || undefined} />
        </div>
        <div className={`field-jn ${errors.date ? "error" : ""}`}>
          <label htmlFor="cf-date">Date / window{tripOptional ? " · optional" : ""}</label>
          <input id="cf-date" name="date" type="text" placeholder="Fri 14 Nov · flexible ±1 day" aria-invalid={errors.date || undefined} />
        </div>
        <div className={`field-jn ${errors.pax ? "error" : ""}`}>
          <label htmlFor="cf-pax">Passengers</label>
          <input id="cf-pax" name="pax" type="text" placeholder="4 adults" aria-invalid={errors.pax || undefined} />
        </div>
      </div>

      <div className={`field-jn ${errors.notes ? "error" : ""}`}>
        <label htmlFor="cf-notes">Anything else</label>
        <textarea
          id="cf-notes"
          name="notes"
          rows={4}
          maxLength={2000}
          aria-invalid={errors.notes || undefined}
          placeholder="Repositioning leg, multi-stop, pets, special catering — whatever the dispatcher should know up front."
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
          — Goes directly to the dispatch desk. Not a marketing list.
        </p>
        <div className="flex items-center gap-6">
          {/* Always-mounted live region so screen readers announce the
              outcome; visually empty until there's something to say. */}
          <span
            role="status"
            aria-live="polite"
            className={[
              "font-mono text-[11px] uppercase tracking-[0.12em]",
              msg?.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
            ].join(" ")}
          >
            {msg?.text ?? ""}
          </span>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Sending…" : "Send to dispatch"} <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </form>
  );
}
