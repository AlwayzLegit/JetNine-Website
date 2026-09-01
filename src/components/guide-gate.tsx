"use client";

import { useState, useTransition, type FormEvent } from "react";
import { requestPricingGuide } from "@/app/(marketing)/guides/actions";
import { track } from "@/lib/analytics";

/**
 * Lead-capture band for the compiled pricing-guide PDF (audit item 14).
 * The chapters stay open — the gate trades an email for the compiled
 * convenience, which is the honest version of the pattern: competitors
 * either gate nothing and capture nothing, or gate everything.
 * On success the download unlocks in place and the link is emailed.
 */
export function GuideGate({ context = "guides-hub" }: { context?: string }) {
  const [errors, setErrors] = useState<Partial<Record<"name" | "email", true>>>({});
  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "error"; text: string }
    | { phase: "done"; url: string }
  >({ phase: "idle" });
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: typeof errors = {};
    if (!(data.get("name") as string)?.trim()) next.name = true;
    const email = ((data.get("email") as string) ?? "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = true;
    if (Object.keys(next).length) {
      setErrors(next);
      setState({ phase: "error", text: "MISSING / INVALID — CHECK NAME & EMAIL" });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await requestPricingGuide(data);
      if (result.ok) {
        setState({ phase: "done", url: result.url });
        track("pricing_guide_requested", { context });
      } else {
        setState({
          phase: "error",
          text: result.error === "RATE_LIMITED" ? "TOO MANY TRIES — WAIT A FEW MINUTES" : `MISSING / INVALID — ${result.error}`,
        });
      }
    });
  }

  return (
    <section aria-label="Download the pricing guide" className="border-t border-ink-3 bg-ink py-20 max-md:py-14">
      <div className="container-jn grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="caption mb-5">— The compiled edition</p>
          <h2 className="font-serif text-[30px] font-normal leading-[1.15] tracking-tight text-bone max-w-[22ch]">
            The whole guide, one PDF.
          </h2>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.6] text-bone-2">
            Rate card, the itemized $47,260 example, four worked lanes, and the ten-question
            broker checklist — compiled for forwarding to whoever signs off. Every chapter stays
            open on the site; the PDF is the convenience, and it costs an email.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
            — No drip campaign · the link, once, to your inbox
          </p>
        </div>

        {state.phase === "done" ? (
          <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--success)]">
              CLEARED — LINK SENT TO YOUR INBOX
            </p>
            <a
              href={state.url}
              target="_blank"
              rel="noopener"
              className="btn btn-primary mt-6"
            >
              Open the guide (PDF) <span className="arrow">→</span>
            </a>
            <p className="mt-5 text-[13px] leading-[1.6] text-bone-2">
              Reading done and a trip in mind? The wizard prices it in about ninety seconds.
            </p>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={onSubmit}
            className="grid grid-cols-1 gap-3 rounded-[4px] border border-ink-3 bg-ink-2 p-6"
          >
            {/* Honeypot — never rendered visibly; bots autofill it. */}
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />
            <div className={`field-jn ${errors.name ? "error" : ""}`}>
              <label htmlFor="gg-name">Name</label>
              <input id="gg-name" name="name" type="text" autoComplete="name" placeholder="Your name" />
            </div>
            <div className={`field-jn ${errors.email ? "error" : ""}`}>
              <label htmlFor="gg-email">Email</label>
              <input id="gg-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" />
            </div>
            <div className="field-jn">
              <label htmlFor="gg-frequency">How often do you fly privately? (optional)</label>
              <select id="gg-frequency" name="frequency" defaultValue="">
                <option value="">Prefer not to say</option>
                <option value="first-trip">Planning a first trip</option>
                <option value="few-per-year">A few times a year</option>
                <option value="monthly">Monthly or more</option>
                <option value="own-program">Currently on a card or program elsewhere</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              {state.phase === "error" ? (
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--error)]">
                  {state.text}
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                  — 5 pages · updated quarterly
                </span>
              )}
              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? "Sending…" : "Get the PDF"} <span className="arrow">→</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
