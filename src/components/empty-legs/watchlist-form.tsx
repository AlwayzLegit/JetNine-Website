"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { createWatchlist } from "@/app/(marketing)/empty-legs/actions";
import { track } from "@/lib/analytics";
import { normalizeFreeformE164 } from "@/lib/phone";
import {
  WATCHLIST_PREFILL_EVENT,
  type WatchlistPrefill,
} from "@/components/empty-legs/legs-board";

type FieldName = "from" | "to" | "earliest" | "latest" | "mobile" | "email";
type Errors = Partial<Record<FieldName, true>>;

const FIELD_LABELS: Record<FieldName, string> = {
  from: "from",
  to: "to",
  earliest: "earliest date",
  latest: "latest date",
  mobile: "mobile",
  email: "email",
};

// The server action answers in upper-case codes ("CHECK YOUR PHONE —
// CONFIRM TO START ALERTS", "RATE_LIMITED"); read them back as a sentence.
function sentence(code: string): string {
  const s = code.replace(/_/g, " ").toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function WatchlistForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // The board's empty-state CTA carries the visitor's date-window filter
  // here so the form starts pre-filled with what they just searched for.
  // Uncontrolled inputs, so set .value directly rather than lifting state.
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const detail = (e as CustomEvent<WatchlistPrefill>).detail;
      if (!detail) return;
      const earliest = document.getElementById("wl-earliest") as HTMLInputElement | null;
      const latest = document.getElementById("wl-latest") as HTMLInputElement | null;
      if (detail.earliest && earliest && !earliest.value) earliest.value = detail.earliest;
      if (detail.latest && latest && !latest.value) latest.value = detail.latest;
    };
    window.addEventListener(WATCHLIST_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(WATCHLIST_PREFILL_EVENT, onPrefill);
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Cheap client-side check so we don't round-trip to the server for
    // obvious missing fields. The Server Action repeats the validation.
    const data = new FormData(e.currentTarget);
    const next: Errors = {};
    const required: FieldName[] = ["from", "to", "earliest", "latest", "mobile"];
    for (const k of required) {
      if (!(data.get(k) as string | null)?.trim()) next[k] = true;
    }
    // Same rule the server applies, so a number we could never text is
    // rejected here instead of after a round trip.
    const mobile = (data.get("mobile") as string)?.trim() ?? "";
    if (mobile && !normalizeFreeformE164(mobile)) next.mobile = true;
    const email = (data.get("email") as string)?.trim() ?? "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = true;

    if (Object.keys(next).length) {
      setErrors(next);
      setMsg({
        tone: "error",
        text: `Check these fields: ${(Object.keys(next) as FieldName[]).map((k) => FIELD_LABELS[k]).join(", ")}.`,
      });
      return;
    }

    setErrors({});
    const form = e.currentTarget;
    startTransition(async () => {
      const result = await createWatchlist(data);
      if (result.ok) {
        setMsg({ tone: "ok", text: `${sentence(result.message)}.` });
        track("empty_leg_watchlist_created", {});
        form.reset();
      } else {
        setMsg({ tone: "error", text: `We couldn't save that — ${sentence(result.error).toLowerCase()}.` });
      }
    });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="relative flex flex-col gap-3">
      {/* Honeypot — humans never see it, autofill bots fill everything.
          The server silently drops submissions that include it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="wl-company">Company</label>
        <input id="wl-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className={`field-jn ${errors.from ? "error" : ""}`}>
          <label htmlFor="wl-from">From</label>
          <input id="wl-from" name="from" type="text" placeholder="Los Angeles" autoComplete="off" />
        </div>
        <div className={`field-jn ${errors.to ? "error" : ""}`}>
          <label htmlFor="wl-to">To</label>
          <input id="wl-to" name="to" type="text" placeholder="Aspen" autoComplete="off" />
        </div>
        <div className={`field-jn ${errors.earliest ? "error" : ""}`}>
          <label htmlFor="wl-earliest">Earliest date</label>
          <input
            id="wl-earliest"
            name="earliest"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className={`field-jn ${errors.latest ? "error" : ""}`}>
          <label htmlFor="wl-latest">Latest date</label>
          <input id="wl-latest" name="latest" type="date" />
        </div>
        <div className={`field-jn ${errors.mobile ? "error" : ""}`}>
          <label htmlFor="wl-mobile">Mobile for texts</label>
          <input
            id="wl-mobile"
            name="mobile"
            type="tel"
            placeholder="+1 (818) 555-0142"
            autoComplete="tel"
            aria-describedby="wl-mobile-hint"
          />
          {/* A bare ten-digit number is read as US. Anyone outside the NANP
              has to say so, or the alert goes to a stranger's phone. */}
          <p id="wl-mobile-hint" className="mt-1.5 text-[13px] text-steel">
            Outside the US? Include your country code.
          </p>
        </div>
        <div className={`field-jn ${errors.email ? "error" : ""}`}>
          <label htmlFor="wl-email">Email (optional)</label>
          <input
            id="wl-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-lg mt-1 w-full disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Saving…" : "Text me when one shows up"}
      </button>

      {msg ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-[14px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}
        >
          {msg.text}
        </p>
      ) : null}

      <p className="text-[13px] text-steel">
        We text once to confirm, then only for matches. Reply STOP any time.
      </p>

      {/* Point-of-collection SMS consent disclosure — carriers audit this
          page against the A2P campaign's stated opt-in flow, so the wording
          here, the confirmation text, and /legal#sms must stay in agreement. */}
      <p className="max-w-[72ch] text-[13px] leading-[1.6] text-steel">
        By creating a watchlist you agree to receive automated alert texts from JetNine at the
        number provided (one message per matching flight; frequency varies). Consent is not a
        condition of purchase. Message &amp; data rates may apply. Reply STOP to cancel, HELP for
        help. See our{" "}
        <a href="/legal#sms" className="text-link">
          SMS terms &amp; privacy policy
        </a>
        .
      </p>
    </form>
  );
}
