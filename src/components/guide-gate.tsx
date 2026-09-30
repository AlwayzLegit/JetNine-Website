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
      setState({ phase: "error", text: "Check your name and email." });
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
          text:
            result.error === "RATE_LIMITED"
              ? "Too many tries — wait a few minutes."
              : `Something went wrong: ${result.error}`,
        });
      }
    });
  }

  return (
    <section aria-label="Download the pricing guide" className="section-jn">
      <div className="container-jn grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="eyebrow">The compiled edition</p>
          <h2 className="title-section max-w-[22ch]">The whole guide, one PDF.</h2>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-[1.6] text-bone-2">
            Rate card, the itemized $47,260 example, four worked lanes, and the ten-question
            broker checklist — compiled for forwarding to whoever signs off. Every chapter stays
            open on the site; the PDF is the convenience, and it costs an email.
          </p>
          <p className="mt-4 text-[14px] text-steel">No drip campaign · the link, once, to your inbox</p>
        </div>

        {state.phase === "done" ? (
          <div className="card card-pad max-md:p-5">
            <p className="text-[14px] font-semibold text-success">Link sent to your inbox.</p>
            <a href={state.url} target="_blank" rel="noopener" className="btn btn-primary btn-lg mt-5">
              Open the guide (PDF) <span className="arrow">→</span>
            </a>
            <p className="mt-5 text-[14px] leading-[1.6] text-bone-2">
              Reading done and a trip in mind? The wizard prices it in about ninety seconds.
            </p>
          </div>
        ) : (
          <form noValidate onSubmit={onSubmit} className="card card-pad grid grid-cols-1 gap-[10px] max-md:p-5">
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
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              {state.phase === "error" ? (
                <span role="alert" className="text-[14px] text-danger">
                  {state.text}
                </span>
              ) : (
                <span className="text-[14px] text-steel">5 pages · updated quarterly</span>
              )}
              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary disabled:cursor-wait disabled:opacity-60 max-md:w-full"
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
