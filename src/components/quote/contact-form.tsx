"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAircraftComplete, isMissionComplete, useQuoteStore } from "@/lib/quote-store";
import { TripSummaryBar } from "@/components/quote/trip-summary";
import { PanelHeader, PanelLabel, QuotePanel } from "@/components/quote/quote-panel";
import { StepFooter } from "@/components/quote/step-footer";
import { CompactField, COMPACT_INPUT_CLASS } from "@/components/quote/compact-field";
import { ContactOptional } from "@/components/quote/contact-optional";
import { CONSENTS, CONTACT_METHODS, COUNTRIES } from "@/components/quote/contact-options";
import { useReplyPromiseWords } from "@/components/quote/reply-promise";

type Errors = Partial<
  Record<"firstName" | "lastName" | "email" | "phone" | "methods" | "consent", true>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 3 of the quote flow — "How to reach you." */
export function ContactForm() {
  const router = useRouter();
  const s = useQuoteStore();
  const when = useReplyPromiseWords();
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!isMissionComplete(s)) router.replace("/quote/mission");
    else if (!isAircraftComplete(s)) router.replace("/quote/aircraft");
  }, [s, router]);

  function onContinue() {
    const next: Errors = {};
    if (!s.firstName.trim()) next.firstName = true;
    if (!s.lastName.trim()) next.lastName = true;
    if (!EMAIL_RE.test(s.email)) next.email = true;
    if (s.phone.replace(/\D/g, "").length < 7) next.phone = true;
    if (!(s.methods.email || s.methods.phone || s.methods.sms)) next.methods = true;
    if (!s.consent.broker || !s.consent.contact) next.consent = true;

    if (Object.keys(next).length) {
      setErrors(next);
      // The primary button is pinned to the bottom on phones, so bring
      // the first marked field back into view.
      requestAnimationFrame(() => {
        document
          .querySelector('[aria-invalid="true"], [data-error="true"]')
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
    setErrors({});
    router.push("/quote/review");
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <QuotePanel>
      <PanelHeader step={3} title="How to reach you.">
        Dispatch returns the quote to you {when} during operating hours. We won&rsquo;t share
        your details — quote requests stay between you and your dispatcher.
      </PanelHeader>

      <TripSummaryBar withCategory />

      {/* Account */}
      <div className="mt-[18px] flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-bone">New here, or flown with us before?</h2>
          <p className="text-[13px] text-steel">Returning clients get one-tap quote requests next time.</p>
        </div>
        <div
          className="grid auto-cols-[minmax(0,1fr)] grid-flow-col overflow-hidden rounded-[3px] border border-line max-sm:w-full"
          role="group"
          aria-label="New or returning client"
        >
          {(
            [
              { id: "new", label: "New here" },
              { id: "returning", label: "Flown before" },
            ] as const
          ).map((a, i) => {
            const on = s.account === a.id;
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() => s.setAccount(a.id)}
                className={[
                  "h-10 whitespace-nowrap px-4 text-[14px] font-semibold transition-colors max-md:h-11",
                  i > 0 ? "border-l border-line" : "",
                  on ? "bg-clearance text-white" : "bg-surface text-bone hover:bg-ink",
                ].join(" ")}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary contact */}
      <section className="mt-[18px]" aria-labelledby="qf-primary">
        <PanelLabel as="h2" id="qf-primary">
          Primary contact
        </PanelLabel>
        <p className="mt-1 text-[13px] text-steel">
          The person dispatch will call. Add a co-traveler later if you&rsquo;d like.
        </p>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
          <CompactField id="qf-first" label="First name" error={errors.firstName}>
            <input
              id="qf-first"
              type="text"
              value={s.firstName}
              onChange={(e) => s.setContactField("firstName", e.target.value)}
              autoComplete="given-name"
              aria-invalid={errors.firstName || undefined}
              className={COMPACT_INPUT_CLASS}
            />
          </CompactField>
          <CompactField id="qf-last" label="Last name" error={errors.lastName}>
            <input
              id="qf-last"
              type="text"
              value={s.lastName}
              onChange={(e) => s.setContactField("lastName", e.target.value)}
              autoComplete="family-name"
              aria-invalid={errors.lastName || undefined}
              className={COMPACT_INPUT_CLASS}
            />
          </CompactField>
          <CompactField id="qf-email" label="Email" error={errors.email}>
            <input
              id="qf-email"
              type="email"
              value={s.email}
              onChange={(e) => s.setContactField("email", e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={errors.email || undefined}
              className={COMPACT_INPUT_CLASS}
            />
          </CompactField>
          <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-2">
            <CompactField id="qf-cc" label="Country">
              <select
                id="qf-cc"
                value={s.phoneCountry}
                onChange={(e) => s.setContactField("phoneCountry", e.target.value)}
                autoComplete="tel-country-code"
                className={`${COMPACT_INPUT_CLASS} h-10 cursor-pointer`}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
            </CompactField>
            <CompactField id="qf-phone" label="Phone" error={errors.phone}>
              <input
                id="qf-phone"
                type="tel"
                value={s.phone}
                onChange={(e) => s.setContactField("phone", e.target.value)}
                placeholder="(818) 555-0142"
                autoComplete="tel-national"
                aria-invalid={errors.phone || undefined}
                className={COMPACT_INPUT_CLASS}
              />
            </CompactField>
          </div>
          <CompactField
            id="qf-company"
            label={
              <>
                Company{" "}
                <span className="font-normal text-steel" aria-hidden>
                  (optional)
                </span>
              </>
            }
            className="col-span-full"
          >
            <input
              id="qf-company"
              type="text"
              value={s.company}
              onChange={(e) => s.setContactField("company", e.target.value)}
              autoComplete="organization"
              className={COMPACT_INPUT_CLASS}
            />
          </CompactField>
        </div>
      </section>

      {/* Follow-up methods — the prototype's "Best way to reach you"
          switch, multi-select (role=checkbox) as before. */}
      <section className="mt-[18px]" data-error={errors.methods ? "true" : undefined}>
        <h2 id="qf-methods" className="text-[13px] font-semibold text-bone">
          How should dispatch follow up?{" "}
          <span className="font-normal text-steel">
            Pick any combination — the first is the primary channel for the initial quote.
          </span>
        </h2>
        <div
          className={[
            "mt-[5px] grid grid-cols-3 overflow-hidden rounded-[3px] border",
            errors.methods ? "border-danger" : "border-line",
          ].join(" ")}
          role="group"
          aria-labelledby="qf-methods"
        >
          {CONTACT_METHODS.map(({ k, name, desc }, i) => {
            const on = s.methods[k];
            return (
              <button
                key={k}
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-describedby={`qf-method-${k}`}
                onClick={() => s.toggleMethod(k)}
                className={[
                  "flex min-h-10 items-center justify-center gap-1.5 px-2 text-[14px] font-semibold transition-colors max-md:min-h-11",
                  i > 0 ? "border-l border-line" : "",
                  on ? "bg-clearance text-white" : "bg-surface text-bone hover:bg-ink",
                ].join(" ")}
              >
                <span aria-hidden className="w-3 text-[12px]">
                  {on ? "✓" : ""}
                </span>
                {name}
                <span id={`qf-method-${k}`} className="sr-only">
                  {desc}
                </span>
              </button>
            );
          })}
        </div>
        {errors.methods ? (
          <p className="mt-2 text-[13px] text-danger">Pick at least one contact method.</p>
        ) : null}
      </section>

      <div className="mt-[18px]">
        <ContactOptional />
      </div>

      {/* Agreements */}
      <section className="mt-[18px]" data-error={errors.consent ? "true" : undefined}>
        <PanelLabel as="h2">A couple of agreements</PanelLabel>
        <p className="mt-1 text-[13px] text-steel">
          Required for the quote — standard FAA Part 295 broker disclosures.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {CONSENTS.map((c) => {
            const on = s.consent[c.k];
            const missing = errors.consent && c.required && !on;
            return (
              <label
                key={c.k}
                className={[
                  "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-[3px] text-[14px]",
                  missing ? "-mx-2 px-2 py-1.5 shadow-[0_0_0_1px_var(--danger)]" : "",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => s.toggleConsent(c.k)}
                  className="mt-[3px] h-[18px] w-[18px] accent-clearance max-md:h-6 max-md:w-6"
                />
                <span>
                  <span className="text-bone">
                    <ConsentText k={c.k} />
                    {c.required ? (
                      <>
                        {" "}
                        <span className="text-danger" aria-hidden>
                          *
                        </span>
                      </>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-steel">{c.sub}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.consent ? (
          <p className="mt-3 text-[13px] text-danger">Both required consents are needed to submit.</p>
        ) : null}
      </section>

      <StepFooter
        step={3}
        backHref="/quote/aircraft"
        backLabel="← Back"
        next={{ label: "Continue to review", onClick: onContinue }}
        error={hasErrors ? "A few things are missing — check the fields marked above." : null}
      />
    </QuotePanel>
  );
}

// Consent sentences — verbatim from the previous contact page (A2P and
// Part 295 wording). Only the broker line carries links.
function ConsentText({ k }: { k: "broker" | "contact" | "marketing" }) {
  if (k === "broker") {
    return (
      <>
        I agree to the{" "}
        <Link href="/legal#part-295" className="text-link-strong">
          Part 295 broker disclosure
        </Link>{" "}
        and{" "}
        <Link href="/legal#agreement" className="text-link-strong">
          Terms of service
        </Link>
        .
      </>
    );
  }
  if (k === "contact") {
    return <>I consent to JetNine contacting me about this quote via the channels selected above.</>;
  }
  return <>Send me empty-leg alerts and seasonal route promotions. (Optional.)</>;
}
