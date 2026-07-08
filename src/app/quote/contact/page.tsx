"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isAircraftComplete,
  isMissionComplete,
  useQuoteStore,
} from "@/lib/quote-store";
import { QuoteSidebar } from "@/components/quote/quote-sidebar";
import { SavedIndicator } from "@/components/quote/saved-indicator";
import { StoreHydrationGate } from "@/components/quote/store-hydration";

const COUNTRIES = [
  { code: "+1", flag: "🇺🇸" },
  { code: "+44", flag: "🇬🇧" },
  { code: "+33", flag: "🇫🇷" },
  { code: "+41", flag: "🇨🇭" },
  { code: "+49", flag: "🇩🇪" },
  { code: "+971", flag: "🇦🇪" },
  { code: "+81", flag: "🇯🇵" },
  { code: "+65", flag: "🇸🇬" },
  { code: "+52", flag: "🇲🇽" },
];

const BEST_TIMES = [
  { id: "any", label: "Any time" },
  { id: "morning", label: "Morning · 6–11" },
  { id: "midday", label: "Midday · 11–2" },
  { id: "afternoon", label: "Afternoon · 2–6" },
  { id: "evening", label: "Evening · 6–10" },
  { id: "latenight", label: "After 10" },
] as const;

const SOURCES = [
  "Referred by a friend",
  "Search",
  "Social",
  "Press / article",
  "Saw a JetNine aircraft",
  "Other",
];

type Errors = Partial<Record<"firstName" | "lastName" | "email" | "phone" | "methods" | "consent", true>>;

export default function ContactStep() {
  return (
    <StoreHydrationGate>
      <ContactStepInner />
    </StoreHydrationGate>
  );
}

function ContactStepInner() {
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) next.email = true;
    if (s.phone.replace(/\D/g, "").length < 7) next.phone = true;
    if (!(s.methods.email || s.methods.phone || s.methods.sms)) next.methods = true;
    if (!s.consent.broker || !s.consent.contact) next.consent = true;

    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    router.push("/quote/review");
  }

  return (
    <div className="container-jn py-12 lg:py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-12">
        <div className="flex flex-col gap-12">
          <header>
            <p className="caption mb-4">— Step 03 · Contact</p>
            <h1 className="display-l max-w-[18ch]">How to reach you.</h1>
            <p className="mt-5 max-w-[60ch] text-[17px] leading-[1.55] text-bone-2">
              Dispatch returns the quote to you within 30 minutes during operating hours. We
              won&rsquo;t share your details — quote requests stay between you and your dispatcher.
            </p>
          </header>

          {/* 01 — Account */}
          <Section n="01" lead="New here, or flown with us before?" sub="Returning clients get one-tap quote requests next time.">
            <div className="inline-flex rounded-[2px] border border-ink-3 bg-ink-2 p-1">
              {(["new", "returning"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => s.setAccount(a)}
                  className={[
                    "rounded-[2px] px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                    s.account === a ? "bg-clearance text-ink" : "text-bone-2 hover:text-bone",
                  ].join(" ")}
                >
                  {a === "new" ? "New to JetNine" : "Returning client"}
                </button>
              ))}
            </div>
          </Section>

          {/* 02 — Personal */}
          <Section n="02" lead="Primary contact." sub="The person dispatch will call. Add a co-traveler later if you'd like.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className={`field-jn ${errors.firstName ? "error" : ""}`}>
                <label htmlFor="qf-first">First name</label>
                <input
                  id="qf-first"
                  type="text"
                  value={s.firstName}
                  onChange={(e) => s.setContactField("firstName", e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className={`field-jn ${errors.lastName ? "error" : ""}`}>
                <label htmlFor="qf-last">Last name</label>
                <input
                  id="qf-last"
                  type="text"
                  value={s.lastName}
                  onChange={(e) => s.setContactField("lastName", e.target.value)}
                  autoComplete="family-name"
                />
              </div>
              <div className={`field-jn md:col-span-2 ${errors.email ? "error" : ""}`}>
                <label htmlFor="qf-email">Email</label>
                <input
                  id="qf-email"
                  type="email"
                  value={s.email}
                  onChange={(e) => s.setContactField("email", e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-[100px_1fr] gap-3">
                <div className="field-jn">
                  <label htmlFor="qf-cc">Country</label>
                  <select
                    id="qf-cc"
                    value={s.phoneCountry}
                    onChange={(e) => s.setContactField("phoneCountry", e.target.value)}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`field-jn ${errors.phone ? "error" : ""}`}>
                  <label htmlFor="qf-phone">Phone</label>
                  <input
                    id="qf-phone"
                    type="tel"
                    value={s.phone}
                    onChange={(e) => s.setContactField("phone", e.target.value)}
                    placeholder="(818) 555-0142"
                    autoComplete="tel-national"
                  />
                </div>
              </div>
              <div className="field-jn md:col-span-2">
                <label htmlFor="qf-company">Company (optional)</label>
                <input
                  id="qf-company"
                  type="text"
                  value={s.company}
                  onChange={(e) => s.setContactField("company", e.target.value)}
                  autoComplete="organization"
                />
              </div>
            </div>
          </Section>

          {/* 03 — Methods */}
          <Section n="03" lead="How should dispatch follow up?" sub="Pick any combination. The first one is the primary channel for the initial quote.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { k: "email" as const, name: "Email", desc: "Quote PDF + itinerary link" },
                { k: "phone" as const, name: "Phone call", desc: "Live walkthrough with dispatch" },
                { k: "sms" as const, name: "SMS", desc: "Real-time updates en-route" },
              ].map(({ k, name, desc }) => {
                const on = s.methods[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => s.toggleMethod(k)}
                    className={[
                      "flex h-full items-start gap-4 rounded-[4px] border bg-ink-2 p-5 text-left transition-colors",
                      on ? "border-clearance" : "border-ink-3 hover:border-bone-2",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "mt-1 flex h-5 w-5 items-center justify-center rounded-[2px] border",
                        on ? "border-clearance bg-clearance text-ink" : "border-ink-4",
                      ].join(" ")}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <div>
                      <div className="font-serif text-[17px] text-bone">{name}</div>
                      <div className="mt-1 text-[13px] leading-[1.5] text-bone-2">{desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.methods ? (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--error)]">
                Pick at least one contact method
              </p>
            ) : null}
          </Section>

          {/* 04 — Best time */}
          <Section n="04" lead="When are you easiest to reach?" sub="All times in your local timezone. Dispatch operates 24/7 — pick what's convenient.">
            <div className="flex flex-wrap gap-2">
              {BEST_TIMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => s.setBestTime(t.id)}
                  className={[
                    "rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                    s.bestTime === t.id
                      ? "border-clearance bg-clearance text-ink"
                      : "border-ink-3 text-bone-2 hover:border-bone-2 hover:text-bone",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Section>

          {/* 05 — Source */}
          <Section n="05" lead="How did you hear about us?" sub="Optional — helps us know which channels are working.">
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => s.setSource(s.source === src ? null : src)}
                  className={[
                    "rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                    s.source === src
                      ? "border-clearance bg-clearance text-ink"
                      : "border-ink-3 text-bone-2 hover:border-bone-2 hover:text-bone",
                  ].join(" ")}
                >
                  {src}
                </button>
              ))}
            </div>
          </Section>

          {/* 06 — Consent */}
          <Section n="06" lead="A couple of agreements." sub="Required for the quote — standard FAA Part 295 broker disclosures.">
            <div className="flex flex-col gap-3">
              {[
                {
                  k: "broker" as const,
                  required: true,
                  text: (
                    <>
                      I agree to the{" "}
                      <Link href="/legal#part-295" className="text-clearance underline underline-offset-2">
                        Part 295 broker disclosure
                      </Link>{" "}
                      and{" "}
                      <Link href="/legal#agreement" className="text-clearance underline underline-offset-2">
                        Terms of service
                      </Link>
                      .
                    </>
                  ),
                  sub: "JetNine acts as an indirect air carrier; flights are operated by FAA Part 135 certified carriers.",
                },
                {
                  k: "contact" as const,
                  required: true,
                  text: "I consent to JetNine contacting me about this quote via the channels selected above.",
                  sub: "Quote-specific only. Marketing consent is separate, below.",
                },
                {
                  k: "marketing" as const,
                  required: false,
                  text: "Send me empty-leg alerts and seasonal route promotions. (Optional.)",
                  sub: "Unsubscribe any time. We never share your information.",
                },
              ].map((c) => {
                const on = s.consent[c.k];
                return (
                  <label
                    key={c.k}
                    className="grid cursor-pointer grid-cols-[auto_1fr] items-start gap-4 rounded-[4px] border border-ink-3 bg-ink-2 p-5"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => s.toggleConsent(c.k)}
                      className="mt-1 h-5 w-5 accent-clearance"
                    />
                    <div>
                      <div className="text-[15px] leading-[1.5] text-bone">
                        {c.text}
                        {c.required ? <span className="ml-2 text-[var(--error)]">*</span> : null}
                      </div>
                      <div className="mt-1.5 text-[12px] leading-[1.5] text-bone-2">{c.sub}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.consent ? (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--error)]">
                Both required consents are needed to submit
              </p>
            ) : null}
          </Section>

          {/* Step actions */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-ink-3 pt-8">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                Step 03 of 04
              </span>
              <SavedIndicator />
            </div>
            <div className="flex items-center gap-6">
              <Link href="/quote/aircraft" className="btn btn-ghost">
                ← Back
              </Link>
              {/* Always clickable so onContinue can surface inline validation
                  (esp. the required-consent message) — gating the button on
                  completeness silently swallowed the click. */}
              <button
                type="button"
                onClick={onContinue}
                className="btn btn-primary btn-lg"
              >
                Continue to review <span className="arrow">→</span>
              </button>
            </div>
          </div>
        </div>

        <QuoteSidebar step={3} />
      </div>
    </div>
  );
}

function Section({
  n,
  lead,
  sub,
  children,
}: {
  n: string;
  lead: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-[200px_1fr] lg:gap-10">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
          — {n}
        </span>
        <h2 className="mt-3 font-serif text-[22px] font-normal leading-[1.2] tracking-tight text-bone">
          {lead}
        </h2>
        <p className="mt-3 text-[13px] leading-[1.55] text-bone-2">{sub}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}
