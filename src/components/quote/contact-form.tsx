"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAircraftComplete, isMissionComplete, useQuoteStore } from "@/lib/quote-store";
import { QuoteSidebar } from "@/components/quote/quote-sidebar";
import { StepFooter } from "@/components/quote/step-footer";
import { CompactField, COMPACT_INPUT_CLASS } from "@/components/quote/compact-field";
import { ContactOptional } from "@/components/quote/contact-optional";
import { CONSENTS, CONTACT_METHODS, COUNTRIES } from "@/components/quote/contact-options";

type Errors = Partial<
  Record<"firstName" | "lastName" | "email" | "phone" | "methods" | "consent", true>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 3 of the quote flow — "How to reach you." */
export function ContactForm() {
  const router = useRouter();
  const s = useQuoteStore();
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
    <>
      <div className="min-w-0">
        <p className="eyebrow">Step 3 · Contact</p>
        <h1 className="title-section !text-[clamp(36px,5vw,52px)] !leading-[1.05]">
          How to reach you.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[17px] text-bone-2">
          Dispatch returns the quote to you within 30 minutes during operating hours. We
          won&rsquo;t share your details — quote requests stay between you and your dispatcher.
        </p>

        {/* Account */}
        <section className="card card-pad mt-9 max-md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="title-card-sm">New here, or flown with us before?</h2>
              <p className="mt-1 text-[14px] text-steel">
                Returning clients get one-tap quote requests next time.
              </p>
            </div>
            <div className="segmented" role="group" aria-label="New or returning client">
              {(
                [
                  { id: "new", label: "New here" },
                  { id: "returning", label: "Flown before" },
                ] as const
              ).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={s.account === a.id}
                  onClick={() => s.setAccount(a.id)}
                  className="max-md:h-11"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Primary contact */}
        <section className="card card-pad mt-4 max-md:p-5">
          <h2 className="title-card-sm">Primary contact</h2>
          <p className="mt-1 text-[14px] text-steel">
            The person dispatch will call. Add a co-traveler later if you&rsquo;d like.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-[10px] md:grid-cols-2">
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
            <CompactField id="qf-email" label="Email" error={errors.email} className="md:col-span-2">
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
            <div className="grid grid-cols-[120px_1fr] gap-[10px] md:col-span-2">
              <CompactField id="qf-cc" label="Country">
                <select
                  id="qf-cc"
                  value={s.phoneCountry}
                  onChange={(e) => s.setContactField("phoneCountry", e.target.value)}
                  autoComplete="tel-country-code"
                  className={COMPACT_INPUT_CLASS}
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
                  <span className="text-steel" aria-hidden>
                    (optional)
                  </span>
                </>
              }
              className="md:col-span-2"
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

        {/* Follow-up methods */}
        <section
          className="card card-pad mt-4 max-md:p-5"
          data-error={errors.methods ? "true" : undefined}
        >
          <h2 className="title-card-sm">How should dispatch follow up?</h2>
          <p className="mt-1 text-[14px] text-steel">
            Pick any combination. The first one is the primary channel for the initial quote.
          </p>
          <div
            className="mt-5 grid grid-cols-1 gap-[10px] md:grid-cols-3"
            role="group"
            aria-label="How dispatch should follow up"
          >
            {CONTACT_METHODS.map(({ k, name, desc }) => {
              const on = s.methods[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => s.toggleMethod(k)}
                  className={[
                    "flex min-h-11 items-start gap-3 rounded-control border bg-ink-2 px-4 py-[14px] text-left text-bone transition-colors",
                    on ? "border-clearance" : "border-line hover:border-line-2",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={[
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border text-[13px]",
                      on ? "border-clearance bg-clearance text-ink" : "border-line-2",
                    ].join(" ")}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span>
                    <span className="block text-[16px] font-medium leading-[1.3]">{name}</span>
                    <span className="mt-0.5 block text-[13px] text-steel">{desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.methods ? (
            <p className="mt-3 text-[14px] text-danger">Pick at least one contact method.</p>
          ) : null}
        </section>

        <div className="mt-4">
          <ContactOptional />
        </div>

        {/* Agreements */}
        <section
          className="card card-pad mt-4 max-md:p-5"
          data-error={errors.consent ? "true" : undefined}
        >
          <h2 className="title-card-sm">A couple of agreements</h2>
          <p className="mt-1 text-[14px] text-steel">
            Required for the quote — standard FAA Part 295 broker disclosures.
          </p>
          <div className="mt-4 flex flex-col gap-[10px]">
            {CONSENTS.map((c) => {
              const on = s.consent[c.k];
              const missing = errors.consent && c.required && !on;
              return (
                <label
                  key={c.k}
                  className={[
                    "grid cursor-pointer grid-cols-[auto_1fr] items-start gap-[14px] rounded-control border bg-ink-2 px-4 py-[14px]",
                    missing ? "border-danger" : "border-line",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => s.toggleConsent(c.k)}
                    className="mt-[3px] h-5 w-5 accent-clearance"
                  />
                  <span>
                    <span className="text-[15px] text-bone">
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
                    <span className="mt-1 block text-[13px] text-steel">{c.sub}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {errors.consent ? (
            <p className="mt-3 text-[14px] text-danger">
              Both required consents are needed to submit.
            </p>
          ) : null}
        </section>

        <StepFooter
          step={3}
          backHref="/quote/aircraft"
          backLabel="← Back"
          next={{ label: "Continue to review", onClick: onContinue }}
          error={hasErrors ? "A few things are missing — check the fields marked above." : null}
        />
      </div>

      <QuoteSidebar step={3} />
    </>
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
