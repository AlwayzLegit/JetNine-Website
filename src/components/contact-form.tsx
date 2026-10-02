"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitContactInquiry } from "@/app/(marketing)/contact/actions";
import { track } from "@/lib/analytics";
import { SITE } from "@/lib/constants";

type FieldName = "first" | "last" | "email" | "mobile" | "from" | "to" | "date" | "pax" | "notes";
type Reason = "quote" | "card" | "trip" | "other";

// Same four reasons the server action's enum accepts — the id is what
// gets posted, the label is what the visitor reads.
const REASONS: { id: Reason; label: string }[] = [
  { id: "quote", label: "Quote a flight" },
  { id: "card", label: "Card / Reserve" },
  { id: "trip", label: "Existing trip" },
  { id: "other", label: "Other" },
];

const NOTES_PLACEHOLDER: Record<Reason, string> = {
  quote:
    "Repositioning leg, multi-stop, pets, special catering — whatever the dispatcher should know up front.",
  card: "How many hours a year you fly, your usual routes, and whether peak dates matter.",
  trip: "Your trip date and route, and what you'd like to change.",
  other: "Whatever's on your mind — press, partnerships, or a question.",
};

const FIELD_LABELS: Record<FieldName, string> = {
  first: "first name",
  last: "last name",
  email: "email",
  mobile: "mobile",
  from: "departing",
  to: "arriving",
  date: "date",
  pax: "passengers",
  notes: "notes",
};

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
      const missing = (Object.keys(next) as FieldName[]).map((k) => FIELD_LABELS[k]);
      setMsg({ tone: "error", text: `Check — ${missing.join(", ")}.` });
      return;
    }
    setErrors({});
    const form = e.currentTarget;
    startTransition(async () => {
      const result = await submitContactInquiry(data);
      if (result.ok) {
        setMsg({ tone: "ok", text: result.message ?? "Sent. A dispatcher will reply within 30 minutes." });
        track("contact_inquiry_submitted", { reason });
        form.reset();
        setReason("quote");
      } else if (result.error === "RATE_LIMITED") {
        setMsg({
          tone: "error",
          text: "Too many sends — wait a few minutes, or call dispatch.",
        });
      } else {
        setMsg({
          tone: "error",
          text: `Not sent. Try again, or call ${SITE.dispatchPhone}.`,
        });
      }
    });
  }

  // Trip fields only make sense when there is a trip to talk about; they
  // are mandatory for a quote and optional for an existing trip.
  const showTrip = reason === "quote" || reason === "trip";
  const optional = reason === "quote" ? "" : " · optional";

  return (
    <form noValidate onSubmit={onSubmit} className="relative flex flex-col gap-5">
      {/* Honeypot — humans never see it, autofill bots fill everything.
          The server silently drops submissions that include it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="cf-company">Company</label>
        <input id="cf-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset>
        <legend className="label-jn mb-2.5">What is this about?</legend>
        <input type="hidden" name="reason" value={reason} />
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              aria-pressed={reason === r.id}
              className="chip h-10 px-4 max-md:h-11"
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
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
          <input id="cf-email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required aria-invalid={errors.email || undefined} />
        </div>
        <div className={`field-jn ${errors.mobile ? "error" : ""}`}>
          <label htmlFor="cf-mobile">Mobile</label>
          <input id="cf-mobile" name="mobile" type="tel" placeholder="+1 (818) 555-0142" autoComplete="tel" aria-invalid={errors.mobile || undefined} />
        </div>
      </div>

      {showTrip ? (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <div className={`field-jn ${errors.from ? "error" : ""}`}>
            <label htmlFor="cf-from">Departing{optional}</label>
            <input id="cf-from" name="from" type="text" placeholder="Los Angeles" aria-invalid={errors.from || undefined} />
          </div>
          <div className={`field-jn ${errors.to ? "error" : ""}`}>
            <label htmlFor="cf-to">Arriving{optional}</label>
            <input id="cf-to" name="to" type="text" placeholder="New York" aria-invalid={errors.to || undefined} />
          </div>
          <div className={`field-jn ${errors.date ? "error" : ""}`}>
            <label htmlFor="cf-date">Date or window{optional}</label>
            <input id="cf-date" name="date" type="text" placeholder="Fri, Nov 14 · flexible ±1 day" aria-invalid={errors.date || undefined} />
          </div>
          <div className={`field-jn ${errors.pax ? "error" : ""}`}>
            <label htmlFor="cf-pax">Passengers</label>
            <input id="cf-pax" name="pax" type="text" placeholder="4 adults" aria-invalid={errors.pax || undefined} />
          </div>
        </div>
      ) : null}

      <div className={`field-jn ${errors.notes ? "error" : ""}`}>
        <label htmlFor="cf-notes">Anything else</label>
        <textarea
          id="cf-notes"
          name="notes"
          rows={4}
          maxLength={2000}
          aria-invalid={errors.notes || undefined}
          placeholder={NOTES_PLACEHOLDER[reason]}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[14px] text-steel">
          Goes directly to the dispatch desk. Not a marketing list.
        </p>
        <button type="submit" className="btn btn-primary btn-lg max-md:w-full" disabled={pending}>
          {pending ? "Sending…" : "Send to dispatch"}{" "}
          <span className="arrow" aria-hidden="true">→</span>
        </button>
      </div>

      {/* Always-mounted live region so screen readers announce the
          outcome; visually empty until there's something to say. */}
      <p
        role="status"
        aria-live="polite"
        className={[
          "text-[14px] empty:hidden",
          msg?.tone === "error" ? "text-danger" : "text-success",
        ].join(" ")}
      >
        {msg?.text ?? ""}
      </p>
    </form>
  );
}
