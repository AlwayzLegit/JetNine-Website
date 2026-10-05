"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { submitContactInquiry } from "@/app/(marketing)/contact/actions";
import { track } from "@/lib/analytics";
import { SITE } from "@/lib/constants";
import { CheckDot, Icon } from "@/components/company/icons";

// Light - Contact form + side column. The visible form follows the
// prototype (three topics, trip type, multi-city legs); what is POSTED is
// unchanged: the server action receives first, last, email, mobile,
// reason (quote | card | trip | other), from, to, date, pax, notes and the
// `company` honeypot, with the same required fields. Prototype-only
// inputs (return date, flexibility, extra legs, booking reference, help
// topic, subject) are folded into the `date` and `notes` text the desk
// already reads.

type FieldName = "first" | "last" | "email" | "from" | "to" | "date" | "notes";
type Topic = "new" | "existing" | "general";
type Trip = "oneway" | "round" | "multi";
type Reason = "quote" | "card" | "trip" | "other";

const TOPICS: { id: Topic; label: string }[] = [
  { id: "new", label: "New charter" },
  { id: "existing", label: "Existing trip" },
  { id: "general", label: "General question" },
];

const TRIPS: { id: Trip; label: string }[] = [
  { id: "oneway", label: "One way" },
  { id: "round", label: "Round trip" },
  { id: "multi", label: "Multi-city" },
];

const SUBJECTS = [
  "Pricing and quotes",
  "Programs and cards",
  "Aircraft and cabins",
  "Safety and operators",
  "Press and partnerships",
];
const CARD_SUBJECT = "Programs and cards";

const HELP_TOPICS = [
  "Change dates or route",
  "Add passengers or bags",
  "Catering or ground transport",
  "Documents and invoices",
  "Something else",
];

const PAX = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12", "14", "16"];

const NOTES: Record<Topic, [string, string]> = {
  new: ["Trip notes", "Preferred timing, baggage, pets or accessibility requests"],
  existing: ["What needs to change?", "Describe the change you need and any deadline"],
  general: ["Your question", "Ask about pricing, programs, aircraft or anything else"],
};
const SUBMIT: Record<Topic, string> = {
  new: "Request a charter quote",
  existing: "Send trip inquiry",
  general: "Send message",
};
const FORM_TITLE: Record<Topic, string> = {
  new: "How can we help?",
  existing: "Help with your existing trip",
  general: "Ask the JetNine team",
};
const SIDE: Record<Topic, [string, string]> = {
  new: ["Already have a trip booked?", "For changes close to departure, call and have your booking reference ready."],
  existing: ["Departure approaching?", "Call with your booking reference for a time-sensitive request."],
  general: ["Prefer a conversation?", "Speak with our team or email us directly. We’re here to help."],
};

const FIELD_LABELS: Record<FieldName, string> = {
  first: "first name",
  last: "last name",
  email: "email",
  from: "from",
  to: "to",
  date: "departure date",
  notes: "notes",
};

const READY = [
  "Route and preferred airports",
  "Dates and preferred local times",
  "Passenger and baggage count",
  "Special requests or flexibility",
];

type Errors = Partial<Record<FieldName, true>>;
type Leg = { id: number };

const label = "flex flex-col gap-[5px] text-[13px] font-bold min-w-0";
const control =
  "h-[38px] w-full min-w-0 rounded-[2px] border border-line bg-white px-[10px] font-sans text-[14px] font-normal text-bone outline-none focus:border-bone focus:shadow-[0_0_0_1px_var(--bone)] max-sm:min-h-[40px]";
const Req = () => <span className="text-danger"> *</span>;
const Opt = ({ t = "(optional)" }: { t?: string }) => <span className="font-normal text-steel"> {t}</span>;

export function ContactForm({ email }: { email: string }) {
  const [topic, setTopic] = useState<Topic>("new");
  const [trip, setTrip] = useState<Trip>("oneway");
  const [legs, setLegs] = useState<Leg[]>([{ id: 1 }, { id: 2 }]);
  const [subject, setSubject] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  // /contact?subject=reserve|card (Programs page links) opens the
  // general tab on "Programs and cards".
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("subject")?.toLowerCase();
    if (s && ["reserve", "card", "cards", "programs", "membership"].includes(s)) {
      setTopic("general");
      setSubject(CARD_SUBJECT);
    }
  }, []);

  const reason: Reason =
    topic === "new" ? "quote" : topic === "existing" ? "trip" : subject === CARD_SUBJECT ? "card" : "other";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const raw = new FormData(e.currentTarget);
    const get = (k: string) => ((raw.get(k) as string | null) ?? "").trim();

    // Fold the prototype-only inputs into the action's fields.
    const data = new FormData();
    for (const k of ["company", "first", "last", "email", "mobile"]) data.set(k, get(k));
    data.set("reason", reason);
    const notesParts: string[] = [];
    if (topic === "new") {
      if (trip === "multi") {
        const rows = legs.map((l, i) => ({
          n: i + 1,
          from: get(`leg-${l.id}-from`),
          to: get(`leg-${l.id}-to`),
          date: get(`leg-${l.id}-date`),
          time: get(`leg-${l.id}-time`),
        }));
        data.set("from", rows[0]?.from ?? "");
        data.set("to", rows[0]?.to ?? "");
        data.set("date", rows[0]?.date ?? "");
        notesParts.push(
          "Multi-city itinerary:\n" +
            rows
              .filter((r) => r.from || r.to || r.date)
              .map((r) => `${r.n}) ${r.from || "?"} → ${r.to || "?"}${r.date ? `, ${r.date}` : ""}${r.time ? ` ${r.time} local` : ""}`)
              .join("\n"),
        );
      } else {
        data.set("from", get("from"));
        data.set("to", get("to"));
        const depart = get("depart");
        const ret = get("return");
        data.set(
          "date",
          depart ? [depart, trip === "round" && ret ? `return ${ret}` : "", raw.get("flexible") ? "flexible" : ""].filter(Boolean).join(" · ") : "",
        );
      }
      data.set("pax", get("pax"));
    } else if (topic === "existing") {
      const ref = get("booking-ref");
      const help = get("help");
      if (ref) notesParts.push(`Booking reference: ${ref}`);
      if (help) notesParts.push(`Help with: ${help}`);
    } else if (subject) {
      notesParts.push(`Subject: ${subject}`);
    }
    const notes = get("notes");
    if (notes) notesParts.push(notes);
    data.set("notes", notesParts.join("\n\n"));

    // Same client check as before — the server action repeats it.
    const next: Errors = {};
    for (const k of ["first", "last", "email"] as const) if (!(data.get(k) as string)) next[k] = true;
    const mail = data.get("email") as string;
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) next.email = true;
    if (reason === "quote") for (const k of ["from", "to", "date"] as const) if (!(data.get(k) as string)) next[k] = true;
    if ((data.get("notes") as string).length > 2000) next.notes = true;
    if (topic === "existing" && !get("help")) {
      setErrors(next);
      setMsg({ tone: "error", text: "Check — what you need help with." });
      return;
    }
    if (Object.keys(next).length) {
      setErrors(next);
      setMsg({ tone: "error", text: `Check — ${(Object.keys(next) as FieldName[]).map((k) => FIELD_LABELS[k]).join(", ")}.` });
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
        setSent(true);
      } else if (result.error === "RATE_LIMITED") {
        setMsg({ tone: "error", text: "Too many sends — wait a few minutes, or call dispatch." });
      } else {
        setMsg({ tone: "error", text: `Not sent. Try again, or call ${SITE.dispatchPhone}.` });
      }
    });
  }

  const err = (k: FieldName) => (errors[k] ? "!border-danger shadow-[0_0_0_1px_var(--danger)]" : "");

  return (
    <section id="form" className="container-jn flex flex-wrap items-start gap-4 pt-5">
      <div className="min-w-0 flex-[999_1_420px] border border-line bg-surface px-6 pb-5 pt-[22px] max-sm:px-4">
        <h2 className="font-serif text-[30px] leading-[1.1]">
          {topic === "new" && trip === "multi" ? "Build your itinerary" : FORM_TITLE[topic]}
        </h2>
        <div role="tablist" aria-label="Topic" className="mt-3 grid auto-cols-[minmax(0,1fr)] grid-flow-col border border-bone">
          {TOPICS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={topic === t.id}
              onClick={() => {
                setTopic(t.id);
                setSent(false);
                setMsg(null);
                setErrors({});
              }}
              className={[
                "min-h-[38px] cursor-pointer px-1 text-[14px] leading-[1.2] max-sm:text-[13px]",
                i ? "border-l border-bone" : "",
                topic === t.id ? "bg-bone font-bold text-white" : "bg-surface text-bone",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {sent ? (
          <div className="mt-[18px] border border-line bg-surface-2 p-5">
            <p className="eyebrow !mb-[6px] !tracking-[0.2em]">Request received</p>
            <div className="font-serif text-[26px] leading-[1.15]">Thank you — a person will be in touch shortly.</div>
            <p className="mt-2 text-[13px] text-steel">An acknowledgement is not a confirmed flight.</p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setMsg(null);
              }}
              className="text-link mt-3 cursor-pointer border-0 bg-transparent p-0 text-[14px]"
            >
              Send another request
            </button>
          </div>
        ) : null}

        <form noValidate onSubmit={onSubmit} hidden={sent} className="relative">
          {/* Honeypot — humans never see it, autofill bots fill everything.
              The server silently drops submissions that include it. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="cf-company">Company</label>
            <input id="cf-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <p className="mt-[10px] text-[12px] text-steel">
            Required fields are marked <span className="text-danger">*</span>.
          </p>

          {topic === "new" ? (
            <div>
              <div role="radiogroup" aria-label="Trip type" className="mt-3 inline-grid grid-cols-3 border border-line max-sm:grid">
                {TRIPS.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={trip === t.id}
                    onClick={() => setTrip(t.id)}
                    className={[
                      "min-h-[30px] cursor-pointer px-4 text-[13px] max-sm:px-2",
                      i ? "border-l border-line" : "",
                      trip === t.id ? "bg-bone text-white" : "bg-white text-bone",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-[14px] grid gap-x-4 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
                {trip !== "multi" ? (
                  <>
                    <label className={label}>
                      <span>From<Req /></span>
                      <input name="from" placeholder="City or airport" autoComplete="off" aria-invalid={errors.from || undefined} className={`${control} ${err("from")}`} />
                    </label>
                    <label className={label}>
                      <span>To<Req /></span>
                      <input name="to" placeholder="City or airport" autoComplete="off" aria-invalid={errors.to || undefined} className={`${control} ${err("to")}`} />
                    </label>
                    <label className={label}>
                      <span>Departure date<Req /></span>
                      <input name="depart" type="date" aria-invalid={errors.date || undefined} className={`${control} ${err("date")}`} />
                    </label>
                    {trip === "round" ? (
                      <label className={label}>
                        <span>Return date<Req /></span>
                        <input name="return" type="date" className={control} />
                      </label>
                    ) : null}
                  </>
                ) : null}
                <label className={label}>
                  <span>Passengers<Req /></span>
                  <select name="pax" defaultValue="" className={control}>
                    <option value="">Select</option>
                    {PAX.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                {trip === "multi" ? (
                  <div className="col-span-full flex flex-col gap-[10px]">
                    {legs.map((l, i) => (
                      <div role="group" aria-label={`Flight ${i + 1}`} key={l.id} className="min-w-0 border border-line bg-white px-[14px] py-3">
                        <div className="flex items-center justify-between text-[12px] font-bold">
                          <span>Flight {i + 1}</span>
                          {i >= 1 ? (
                            <button
                              type="button"
                              onClick={() => setLegs((ls) => ls.filter((x) => x.id !== l.id))}
                              className="min-h-7 cursor-pointer border-0 bg-transparent p-0 text-[12px] font-normal text-danger"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-2 grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
                          <label className={`${label} !text-[12px]`}>
                            <span>From<Req /></span>
                            <input name={`leg-${l.id}-from`} placeholder="City or airport" autoComplete="off" className={`${control} ${i === 0 ? err("from") : ""}`} />
                          </label>
                          <label className={`${label} !text-[12px]`}>
                            <span>To<Req /></span>
                            <input name={`leg-${l.id}-to`} placeholder="City or airport" autoComplete="off" className={`${control} ${i === 0 ? err("to") : ""}`} />
                          </label>
                          <label className={`${label} !text-[12px]`}>
                            <span>Departure date<Req /></span>
                            <input name={`leg-${l.id}-date`} type="date" className={`${control} ${i === 0 ? err("date") : ""}`} />
                          </label>
                          <label className={`${label} !text-[12px]`}>
                            <span>Departure time<Opt /></span>
                            <input name={`leg-${l.id}-time`} type="time" className={control} />
                          </label>
                        </div>
                        <p className="mt-1 text-[12px] text-steel">Local airport time</p>
                      </div>
                    ))}
                    {legs.length < 6 ? (
                      <button
                        type="button"
                        onClick={() => setLegs((ls) => [...ls, { id: Math.max(...ls.map((x) => x.id)) + 1 }])}
                        className="h-9 cursor-pointer border border-line bg-white text-[13px] text-bone"
                      >
                        + Add another flight
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {trip !== "multi" ? (
                <label className="mt-[10px] flex min-h-7 items-center gap-[10px] text-[13px]">
                  <input type="checkbox" name="flexible" className="m-0 h-4 w-4 accent-[var(--bone)]" />
                  My dates are flexible
                </label>
              ) : null}
            </div>
          ) : null}

          {topic === "existing" ? (
            <div className="mt-[14px] grid gap-3">
              <label className={label}>
                <span>Booking reference<Opt t="(if available)" /></span>
                <input name="booking-ref" placeholder="Enter your reference" className={control} />
              </label>
              <label className={label}>
                <span>What do you need help with?<Req /></span>
                <select name="help" defaultValue="" className={control}>
                  <option value="">Choose a topic</option>
                  {HELP_TOPICS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {topic === "general" ? (
            <div className="mt-[14px] grid gap-x-4 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
              <label className={label}>
                <span>Subject</span>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className={control}>
                  <option value="">Choose a topic</option>
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="mt-4 border-t border-line pt-[14px] text-[14px] font-bold">Your contact details</div>
          <div className="mt-[10px] grid gap-x-4 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
            <label className={label}>
              <span>First name<Req /></span>
              <input name="first" autoComplete="given-name" placeholder="First name" aria-invalid={errors.first || undefined} className={`${control} ${err("first")}`} />
            </label>
            <label className={label}>
              <span>Last name<Req /></span>
              <input name="last" autoComplete="family-name" placeholder="Last name" aria-invalid={errors.last || undefined} className={`${control} ${err("last")}`} />
            </label>
            <label className={label}>
              <span>Email<Req /></span>
              <input name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={errors.email || undefined} className={`${control} ${err("email")}`} />
            </label>
            <label className={label}>
              <span>Phone<Opt /></span>
              <input name="mobile" type="tel" autoComplete="tel" placeholder="Include country code" className={control} />
            </label>
            <label className={`${label} col-span-full`}>
              <span>
                {NOTES[topic][0]}
                <Opt />
              </span>
              <textarea
                name="notes"
                rows={3}
                maxLength={2000}
                placeholder={NOTES[topic][1]}
                aria-invalid={errors.notes || undefined}
                className={`${control} !h-auto py-[10px] leading-[1.5] ${err("notes")}`}
              />
            </label>
          </div>
          <p className="mt-[6px] text-[12px] text-steel">Please do not include payment details or identity documents.</p>
          <p className="mt-[10px] text-[13px]">
            We use these details to respond to your inquiry.{" "}
            <Link href="/legal#what-we-collect" className="text-link">
              Privacy policy.
            </Link>
          </p>
          <button type="submit" disabled={pending} className="btn btn-primary mt-[14px] w-full !font-bold">
            {pending ? "Sending…" : `${SUBMIT[topic]} →`}
          </button>
          <p className="mt-2 text-center text-[12px] text-steel">Submitting a request does not confirm a flight.</p>
        </form>

        {/* Always-mounted live region so screen readers announce the outcome. */}
        <p
          role="status"
          aria-live="polite"
          className={["mt-2 text-[14px] empty:hidden", msg?.tone === "error" ? "text-danger" : "text-success"].join(" ")}
        >
          {msg?.text ?? ""}
        </p>
      </div>

      <aside className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-4">
        <div className="on-navy bg-navy px-[22px] py-6">
          <h2 className="font-serif text-[26px] leading-[1.15]">{SIDE[topic][0]}</h2>
          <p className="mt-[10px] text-[14px] leading-[1.5] text-bone-2">{SIDE[topic][1]}</p>
          <a
            href={`tel:${SITE.dispatchPhoneE164}`}
            className="mt-4 flex h-[42px] items-center justify-center gap-[10px] rounded-[2px] bg-[#ECE8DF] font-serif text-[16px] text-[#12232E] hover:bg-white"
          >
            Call {SITE.dispatchPhone} <span aria-hidden="true" className="arrow-sm">↗</span>
          </a>
          <p className="mt-[10px] text-[12px] text-bone-2">
            Or email{" "}
            <a href={`mailto:${email}`} className="text-white underline underline-offset-2">
              {email}
            </a>
            . A change request is not confirmed until acknowledged.
          </p>
        </div>
        <div className="border border-line bg-surface p-[22px]">
          <h3 className="font-serif text-[24px] leading-[1.15]">Useful details to have ready</h3>
          <ul className="mt-[14px] flex list-none flex-col gap-[10px] p-0">
            {READY.map((r) => (
              <li key={r} className="flex items-center gap-3 font-serif text-[15px]">
                <CheckDot size={20} outline />
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border border-line bg-surface p-[22px]">
          <div>
            <h3 className="font-serif text-[24px] leading-[1.15]">Based in Los Angeles</h3>
            <p className="mt-2 font-serif text-[15px] leading-[1.45] text-steel">
              {SITE.address.line1}, {SITE.address.cityState}. Contact the team before arranging an in-person visit.
            </p>
          </div>
          <Icon name="pin" className="h-[26px] w-[26px]" />
        </div>
      </aside>
    </section>
  );
}
