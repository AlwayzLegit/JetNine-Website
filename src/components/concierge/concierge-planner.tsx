"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  areaCls,
  btnPrimary,
  btnSecondary,
  checkCls,
  ChecklistBody,
  controlCls,
  datesLine,
  DialogTitle,
  DrawerFrame,
  ErrorLine,
  fmtDate,
  InfoNote,
  journeyLine,
  labelCls,
  linkBtn,
  ModalBody,
  plural,
  printChecklist,
  ReviewPanel,
  sendPlannerInquiry,
  Sheet,
  TRIP_LABEL,
  useScrollLock,
  validateContact,
  validateTrip,
  type CheckItem,
  type Contact,
  type TripType,
} from "./kit";
import { PATHS } from "./sections";

/* Light - Concierge: trip planner drawer, review, checklist, destination
   preferences and "plans changed" support windows. */

type Dlg = null | "trip" | "review" | "checklist" | "dest" | "support";
type DestFrom = null | "trip" | "review";

const SERVICES = ["Flights", "Chauffeur", "Catering", "Stay", "Experiences"] as const;
type Service = (typeof SERVICES)[number];

export const CONCIERGE_CHECKS: CheckItem[] = [
  { short: "Named operator", t: "Operating carrier and aircraft", b: "Identify the carrier and check the aircraft fit." },
  { short: "Confirmed itinerary", t: "Route, dates and local times", b: "Confirm airports, terminals and schedule." },
  { short: "Itemized total", t: "Itemized price and included services", b: "Review extras and who can authorize changes." },
  { short: "Supplier terms", t: "Supplier deposits and cancellation terms", b: "Understand separate terms for onward arrangements." },
  { short: "Dietary & access needs", t: "Dietary, baggage and mobility needs", b: "Confirm the specific aircraft and supplier arrangements." },
  { short: "Trip contact & backup plan", t: "Trip contact and change arrangements", b: "Keep the advisor and escalation details close." },
];

const SUPPORT = [
  { d: PATHS.plane, t: "Flight or aircraft change", sub: "Ask your advisor about available alternatives.", b: "Confirm the new operating carrier, aircraft fit, timing and revised total before accepting a change." },
  { d: PATHS.hotel, t: "Transfer, hotel or dining change", sub: "Check revised timing and supplier charges.", b: "Review pickup times, connections and supplier availability. Ask which deposits, waiting charges or cancellation terms apply to each affected booking." },
  { d: PATHS.alert, t: "Urgent travel disruption", sub: "Use your trip contact and agreed escalation route.", b: "Ask when the next update is due and what remains unconfirmed." },
];

const EMPTY = {
  from: "", to: "", type: "round" as TripType, date: "", ret: "", time: "", stops: "", adults: "4", needs: "",
  menu: "", allergies: "", ground: "", budget: "",
  destCity: "", checkIn: "", checkOut: "", rooms: "", stayPrefs: "", dineDate: "", dineTime: "", dinePrefs: "", expDate: "", expPrefs: "", expBudget: "",
};
type Fields = typeof EMPTY;

function usePlannerState() {
  const [dlg, setDlg] = useState<Dlg>(null);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [f, setF] = useState<Fields>(EMPTY);
  const [svc, setSvc] = useState<Partial<Record<Service, boolean>>>({ Flights: true });
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [contact, setContactState] = useState<Contact>({ name: "", email: "", contact: "Email", phone: "" });
  const [destFrom, setDestFrom] = useState<DestFrom>(null);
  const [destAdded, setDestAdded] = useState(false);
  const [tab, setTab] = useState<"Stays" | "Dining" | "Experiences">("Stays");
  const [prio, setPrio] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErr("");
  };
  const setContact = (patch: Partial<Contact>) => {
    setContactState((s) => ({ ...s, ...patch }));
    setErr("");
  };
  const adults = Math.max(0, parseInt(f.adults, 10) || 0);
  const tripErr = () => validateTrip({ ...f, adults });
  const open = (d: Exclude<Dlg, null>) => {
    setErr("");
    if (d === "trip") setStep(0);
    if (d === "dest") setDestFrom(null);
    setDlg(d);
  };
  const close = () => {
    setDlg(null);
    setErr("");
  };

  return {
    dlg, setDlg, step, setStep, err, setErr, sent, setSent, f, set, svc, setSvc, checks, setChecks, contact, setContact,
    destFrom, setDestFrom, destAdded, setDestAdded, tab, setTab, prio, setPrio, pending, startTransition,
    adults, tripErr, open, close,
  };
}

type Planner = ReturnType<typeof usePlannerState>;
const Ctx = createContext<Planner | null>(null);

function usePlanner(): Planner {
  const p = useContext(Ctx);
  if (!p) throw new Error("Concierge planner controls must sit inside <ConciergeProvider>.");
  return p;
}

export function ConciergeProvider({ children }: { children: ReactNode }) {
  const p = usePlannerState();
  useScrollLock(p.dlg !== null);
  return (
    <Ctx.Provider value={p}>
      {children}
      <TripSheet />
      <ReviewSheet />
      <ChecklistSheet />
      <DestSheet />
      <SupportSheet />
    </Ctx.Provider>
  );
}

/** Any button on the page that opens one of the planner windows. */
export function ConciergeButton({
  open,
  className,
  children,
}: {
  open: "trip" | "checklist" | "dest" | "support";
  className: string;
  children: ReactNode;
}) {
  const p = usePlanner();
  return (
    <button type="button" onClick={() => p.open(open)} className={className}>
      {children}
    </button>
  );
}

/* ---------------- Sidebar "Plan your journey" box ---------------- */

export function ConciergeSidebarForm() {
  const p = usePlanner();
  const { f, set } = p;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="mb-[5px] block text-[12px] font-bold">Route</span>
        <div className="grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-center gap-[6px]">
          <input type="text" aria-label="From airport" value={f.from} onChange={(e) => set("from", e.target.value)} placeholder="From airport" className={controlCls} />
          <button
            type="button"
            onClick={() => {
              set("from", f.to);
              set("to", f.from);
            }}
            aria-label="Swap departure and destination"
            className="h-8 w-8 cursor-pointer border-0 bg-transparent p-1"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--bone)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 7h13l-3-3M17 17H4l3 3" />
            </svg>
          </button>
          <input type="text" aria-label="To airport" value={f.to} onChange={(e) => set("to", e.target.value)} placeholder="To airport" className={controlCls} />
        </div>
      </div>
      <div>
        <span className="mb-[5px] block text-[12px] font-bold">Travel date &amp; local time</span>
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,110px),1fr))]">
          <input type="date" aria-label="Travel date" value={f.date} onChange={(e) => set("date", e.target.value)} className={controlCls} />
          <input type="time" aria-label="Local departure time" value={f.time} onChange={(e) => set("time", e.target.value)} className={controlCls} />
        </div>
      </div>
      <label className={labelCls}>
        Passengers
        <select value={String(p.adults || 1)} onChange={(e) => set("adults", e.target.value)} className={controlCls}>
          {Array.from({ length: 19 }, (_, i) => String(i + 1)).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <div role="group" aria-label="Services requested">
        <span className="mb-2 block text-[12px] font-bold">Services requested</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {SERVICES.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" checked={!!p.svc[s]} onChange={() => p.setSvc((v) => ({ ...v, [s]: !v[s] }))} className={checkCls} />
              {s}
            </label>
          ))}
        </div>
      </div>
      <label className={labelCls}>
        Special requests
        <textarea rows={2} value={f.needs} onChange={(e) => set("needs", e.target.value)} placeholder="Baggage, dietary or mobility needs" className={areaCls} />
      </label>
      <label className={labelCls}>
        Email
        <input
          type="email"
          value={p.contact.email}
          onChange={(e) => p.setContact({ email: e.target.value })}
          placeholder="you@example.com"
          autoComplete="email"
          className={controlCls}
        />
      </label>
      <button type="button" onClick={() => p.open("trip")} className={btnPrimary}>
        Request a tailored plan →
      </button>
      <p className="m-0 text-[12px] text-steel">Your request is an inquiry, not a confirmed booking.</p>
    </div>
  );
}

/* ---------------- Inline checklist chips (What to confirm) ---------------- */

export function ConciergeChecks() {
  const p = usePlanner();
  return (
    <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-3">
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        {CONCIERGE_CHECKS.map((c, i) => (
          <label key={c.t} className="flex cursor-pointer items-center gap-[10px] border border-line bg-surface px-3 py-[9px] text-[13px]">
            <input
              type="checkbox"
              checked={!!p.checks[i]}
              onChange={() => p.setChecks((s) => ({ ...s, [i]: !s[i] }))}
              className="m-0 h-4 w-4 flex-none accent-[var(--gold)] max-sm:h-6 max-sm:w-6"
            />
            {c.short}
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={() => p.open("checklist")} className={btnPrimary}>
          Open planning checklist →
        </button>
      </div>
    </div>
  );
}

/* ---------------- Windows ---------------- */

function destSummary(p: Planner) {
  if (!p.destAdded) return "";
  const { f } = p;
  const parts: string[] = [];
  if (f.destCity || f.checkIn)
    parts.push(
      `Stay${f.destCity ? ` in ${f.destCity}` : ""}${f.checkIn ? `, ${fmtDate(f.checkIn)}${f.checkOut ? ` – ${fmtDate(f.checkOut)}` : ""}` : ""}`,
    );
  if (f.dineDate || f.dinePrefs) parts.push(`Dining${f.dineDate ? ` ${fmtDate(f.dineDate)}` : ""}`);
  if (f.expDate || f.expPrefs) parts.push(`Experience${f.expDate ? ` ${fmtDate(f.expDate)}` : ""}`);
  return parts.join("; ");
}

function TripSheet() {
  const p = usePlanner();
  const { f, set, step } = p;
  const goStep1 = () => {
    const e = p.tripErr();
    if (e) return p.setErr(e);
    p.setErr("");
    p.setStep(1);
  };
  const toReview = () => {
    const e = p.tripErr();
    if (e) {
      p.setStep(0);
      return p.setErr(e);
    }
    p.setErr("");
    p.setSent(false);
    p.setDlg("review");
  };
  const summary = destSummary(p);

  return (
    <Sheet open={p.dlg === "trip"} onClose={p.close} variant="drawer" labelledBy="cg-trip-title">
      <DrawerFrame
        titleId="cg-trip-title"
        title={step === 0 ? "Plan your journey" : "Shape the details"}
        sub={step === 0 ? "Tell us the essentials. We’ll confirm the options." : "Add preferences. Your advisor confirms what’s possible."}
        steps={["Trip details", "Preferences", "Review"]}
        step={step}
        onClose={p.close}
        footer={
          <>
            <ErrorLine err={p.err} />
            {step === 0 ? (
              <div className="flex flex-col gap-[6px]">
                <button type="button" onClick={goStep1} className={`${btnPrimary} w-full`}>
                  Continue to preferences →
                </button>
                <span className="text-center text-[12px] text-steel">
                  {plural(p.adults, "passenger", "passengers")} · {TRIP_LABEL[f.type]} · An inquiry does not confirm an aircraft or reservation.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-[10px]">
                <button type="button" onClick={() => p.setStep(0)} className={btnSecondary}>
                  Back
                </button>
                <button type="button" onClick={toReview} className={btnPrimary}>
                  Review request →
                </button>
              </div>
            )}
          </>
        }
      >
        {step === 0 ? (
          <div className="flex flex-col gap-[14px]">
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
              <label className={labelCls}>
                From
                <input type="text" value={f.from} onChange={(e) => set("from", e.target.value)} placeholder="Airport or city" className={controlCls} />
              </label>
              <label className={labelCls}>
                To
                <input type="text" value={f.to} onChange={(e) => set("to", e.target.value)} placeholder="Airport or city" className={controlCls} />
              </label>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
              <label className={labelCls}>
                Departure date
                <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={controlCls} />
              </label>
              <label className={labelCls}>
                Local departure time
                <input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} className={controlCls} />
              </label>
            </div>
            {f.type === "round" ? (
              <label className={labelCls}>
                Return date
                <input type="date" value={f.ret} onChange={(e) => set("ret", e.target.value)} className={controlCls} />
              </label>
            ) : null}
            <div className="grid items-end gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
              <label className={labelCls}>
                Passengers
                <input type="number" min={1} value={f.adults} onChange={(e) => set("adults", e.target.value)} className={controlCls} />
              </label>
              <div role="radiogroup" aria-label="Trip type" className="flex flex-col gap-[5px]">
                <span className="text-[12px] font-bold">Trip type</span>
                <div className="flex border border-line">
                  {(["one", "round", "multi"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={f.type === k}
                      onClick={() => set("type", k)}
                      className={`h-[38px] flex-1 cursor-pointer whitespace-nowrap border-0 px-[6px] text-[12px] ${f.type === k ? "bg-bone text-white" : "bg-white text-bone"}`}
                    >
                      {TRIP_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {f.type === "multi" ? (
              <label className={labelCls}>
                Additional stops and dates
                <textarea rows={3} value={f.stops} onChange={(e) => set("stops", e.target.value)} placeholder="List each additional city and preferred timing" className={areaCls} />
              </label>
            ) : null}
            <p className="-mt-1 text-[12px] text-steel">Still flexible? Leave dates blank and discuss them with your advisor.</p>
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 p-0 text-[12px] font-bold">Add to your request</legend>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map((s) => {
                  const on = !!p.svc[s];
                  return (
                    <label key={s} className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-[13px] ${on ? "border-bone bg-ink" : "border-line bg-white"}`}>
                      <input type="checkbox" checked={on} onChange={() => p.setSvc((v) => ({ ...v, [s]: !v[s] }))} className={checkCls} />
                      {s}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="relative aspect-[16/7] overflow-hidden bg-[#ECE8DF]">
              <Image src="/images/concierge/cabin-dining.webp" alt="Dining table set for a meal beside a private jet window." fill sizes="460px" className="object-cover" style={{ objectPosition: "center 60%" }} />
            </div>
            <label className={labelCls}>
              Baggage &amp; mobility needs
              <textarea rows={2} value={f.needs} onChange={(e) => set("needs", e.target.value)} placeholder="Tell us about any special requirements" className={areaCls} />
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-[14px]">
            <label className={labelCls}>
              Catering &amp; cabin preferences
              <textarea rows={2} value={f.menu} onChange={(e) => set("menu", e.target.value)} placeholder="Menu, wine or cabin requests" className={areaCls} />
            </label>
            <label className={labelCls}>
              Allergies &amp; dietary requirements
              <input type="text" value={f.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Tell us what the caterer must know" className={controlCls} />
            </label>
            <label className={labelCls}>
              Ground transport &amp; connections
              <input type="text" value={f.ground} onChange={(e) => set("ground", e.target.value)} placeholder="Chauffeur pickup, helicopter or yacht" className={controlCls} />
            </label>
            <div className="flex items-center gap-[14px] border border-line px-[14px] py-3">
              <div className="relative h-[60px] w-[84px] flex-none overflow-hidden bg-[#ECE8DF]">
                <Image src="/images/concierge/hotel-terrace.webp" alt="" aria-hidden fill sizes="84px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-serif text-[18px]">Your destination, arranged</span>
                <span className="block text-[13px] text-steel">{summary || "Add hotel, dining or experience preferences."}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  p.setDestFrom("trip");
                  p.setDlg("dest");
                }}
                className={`${linkBtn} flex-none`}
              >
                {p.destAdded ? "Edit →" : "Add →"}
              </button>
            </div>
            <label className={labelCls}>
              Budget guidance (optional)
              <input type="text" value={f.budget} onChange={(e) => set("budget", e.target.value)} placeholder="A range helps your advisor shortlist options" className={controlCls} />
            </label>
            <InfoNote>Requested extras remain subject to operator or supplier approval, availability and written terms.</InfoNote>
          </div>
        )}
      </DrawerFrame>
    </Sheet>
  );
}

function ReviewSheet() {
  const p = usePlanner();
  const { f } = p;
  const svcOn = SERVICES.filter((s) => p.svc[s]);
  const toTrip = (step: number) => () => {
    p.setErr("");
    p.setStep(step);
    p.setDlg("trip");
  };
  const rows = [
    { k: "Journey", v: journeyLine(f), onEdit: toTrip(0) },
    { k: "Passengers", v: plural(p.adults, "passenger", "passengers"), onEdit: toTrip(0) },
    { k: "Dates", v: datesLine(f), onEdit: toTrip(0) },
    { k: "Services", v: svcOn.join(", ") || "Nothing selected yet", onEdit: toTrip(0) },
    {
      k: "Destination",
      v: destSummary(p) || "Not added",
      onEdit: () => {
        p.setDestFrom("review");
        p.setDlg("dest");
      },
    },
  ];

  const send = () => {
    const e = validateContact(p.contact);
    if (e) return p.setErr(e);
    p.setErr("");
    p.startTransition(async () => {
      const failure = await sendPlannerInquiry({
        source: "concierge",
        contact: p.contact,
        from: f.from,
        to: f.to,
        date: f.date ? datesLine(f) : "",
        pax: plural(p.adults, "passenger", "passengers"),
        lines: [
          ["Trip type", TRIP_LABEL[f.type]],
          ["Journey", journeyLine(f)],
          ["Dates", datesLine(f)],
          ["Services", svcOn.join(", ")],
          ["Baggage & mobility", f.needs],
          ["Catering & cabin", f.menu],
          ["Allergies & dietary", f.allergies],
          ["Ground transport", f.ground],
          ["Budget", f.budget],
          ["Destination", destSummary(p)],
          ["Stay preferences", p.destAdded ? [f.rooms, f.stayPrefs, Object.keys(p.prio).filter((k) => p.prio[k]).join(", ")].filter(Boolean).join(" · ") : ""],
          ["Dining preferences", p.destAdded ? [f.dineTime, f.dinePrefs].filter(Boolean).join(" · ") : ""],
          ["Experience", p.destAdded ? [f.expPrefs, f.expBudget].filter(Boolean).join(" · ") : ""],
          ["Preferred contact", p.contact.contact],
        ],
      });
      if (failure) p.setErr(failure);
      else p.setSent(true);
    });
  };

  return (
    <Sheet open={p.dlg === "review"} onClose={p.close} width={620} labelledBy="cg-review-title">
      <ReviewPanel
        titleId="cg-review-title"
        title="Review your travel request"
        rows={rows}
        contact={p.contact}
        setContact={p.setContact}
        radioName="cg-contact"
        err={p.err}
        pending={p.pending}
        sent={p.sent}
        onBack={toTrip(1)}
        onSend={send}
        onChecklist={() => p.setDlg("checklist")}
        onClose={p.close}
      />
    </Sheet>
  );
}

function ChecklistSheet() {
  const p = usePlanner();
  const [openIdx, setOpenIdx] = useState(-1);
  return (
    <Sheet open={p.dlg === "checklist"} onClose={p.close} width={580} labelledBy="cg-check-title">
      <ModalBody onClose={p.close} closeLabel="Close checklist">
        <DialogTitle id="cg-check-title" className="pr-[30px]">
          Your pre-travel checklist
        </DialogTitle>
        <p className="mb-[14px] mt-1 text-[14px] text-steel">Confirm each detail with your advisor.</p>
        <ChecklistBody
          items={CONCIERGE_CHECKS}
          done={p.checks}
          toggle={(i) => p.setChecks((s) => ({ ...s, [i]: !s[i] }))}
          expand
          openIdx={openIdx}
          setOpenIdx={setOpenIdx}
          progressWord="confirmed"
        />
        <InfoNote className="mt-[14px]">Keep written confirmations together. Requested extras are not confirmed until accepted.</InfoNote>
        <div className="mt-[18px] grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          <button
            type="button"
            onClick={() => printChecklist("Your pre-travel checklist", "JetNine pre-travel checklist", CONCIERGE_CHECKS, p.checks)}
            className={btnSecondary}
          >
            Print checklist
          </button>
          <button type="button" onClick={p.close} className={btnPrimary}>
            Done
          </button>
        </div>
      </ModalBody>
    </Sheet>
  );
}

function DestSheet() {
  const p = usePlanner();
  const { f, set, tab } = p;
  const back = () => {
    if (p.destFrom === "trip") {
      p.setStep(1);
      p.setDlg("trip");
    } else if (p.destFrom === "review") p.setDlg("review");
    else p.close();
  };
  const add = () => {
    const extra: Partial<Record<Service, boolean>> = {};
    if (f.destCity || f.checkIn) extra.Stay = true;
    if (f.expDate || f.expPrefs) extra.Experiences = true;
    p.setDestAdded(true);
    p.setSvc((s) => ({ ...s, ...extra }));
    p.setErr("");
    if (p.destFrom === "review") p.setDlg("review");
    else {
      p.setStep(1);
      p.setDlg("trip");
    }
  };

  return (
    <Sheet open={p.dlg === "dest"} onClose={p.close} width={600} labelledBy="cg-dest-title">
      <ModalBody onClose={p.close} closeLabel="Close destination preferences">
        <DialogTitle id="cg-dest-title" className="pr-[30px]">
          Make the destination yours
        </DialogTitle>
        <p className="mb-[14px] mt-1 text-[14px] text-steel">Add preferences to your travel request.</p>
        <div className="relative aspect-[16/6] overflow-hidden bg-[#ECE8DF]">
          <Image
            src="/images/concierge/hotel-terrace.webp"
            alt="Rooftop terrace with lounge seating overlooking a city skyline at sunset."
            fill
            sizes="560px"
            className="object-cover"
            style={{ objectPosition: "center 45%" }}
          />
        </div>
        <div role="tablist" aria-label="Destination preferences" className="mt-3 flex border-b border-line">
          {(["Stays", "Dining", "Experiences"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => p.setTab(t)}
              className={`h-10 flex-1 cursor-pointer border-0 bg-transparent text-[14px] text-bone ${tab === t ? "font-bold shadow-[inset_0_-2px_0_var(--bone)]" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="flex flex-col gap-3 pt-[14px]">
          {tab === "Stays" ? (
            <>
              <label className={labelCls}>
                Destination
                <input type="text" value={f.destCity} onChange={(e) => set("destCity", e.target.value)} placeholder="City, resort or neighbourhood" className={controlCls} />
              </label>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
                <label className={labelCls}>
                  Check-in
                  <input type="date" value={f.checkIn} onChange={(e) => set("checkIn", e.target.value)} className={controlCls} />
                </label>
                <label className={labelCls}>
                  Check-out
                  <input type="date" value={f.checkOut} onChange={(e) => set("checkOut", e.target.value)} className={controlCls} />
                </label>
              </div>
              <label className={labelCls}>
                Rooms &amp; guests
                <input type="text" value={f.rooms} onChange={(e) => set("rooms", e.target.value)} placeholder="e.g. 2 rooms · 4 guests" className={controlCls} />
              </label>
              <label className={labelCls}>
                Preferences
                <textarea rows={2} value={f.stayPrefs} onChange={(e) => set("stayPrefs", e.target.value)} placeholder="Hotel style, location, accessibility or special occasion" className={areaCls} />
              </label>
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-2 p-0 text-[12px] font-bold">Share your priorities</legend>
                <div className="flex flex-wrap gap-x-[22px] gap-y-2">
                  {["Location", "Room setup", "Budget range"].map((label) => (
                    <label key={label} className="flex cursor-pointer items-center gap-2 text-[13px]">
                      <input type="checkbox" checked={!!p.prio[label]} onChange={() => p.setPrio((s) => ({ ...s, [label]: !s[label] }))} className={checkCls} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : tab === "Dining" ? (
            <>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
                <label className={labelCls}>
                  Dining date
                  <input type="date" value={f.dineDate} onChange={(e) => set("dineDate", e.target.value)} className={controlCls} />
                </label>
                <label className={labelCls}>
                  Local time
                  <input type="time" value={f.dineTime} onChange={(e) => set("dineTime", e.target.value)} className={controlCls} />
                </label>
              </div>
              <label className={labelCls}>
                Restaurant &amp; menu preferences
                <textarea rows={3} value={f.dinePrefs} onChange={(e) => set("dinePrefs", e.target.value)} placeholder="Cuisine, restaurant names, dietary needs or occasion" className={areaCls} />
              </label>
            </>
          ) : (
            <>
              <label className={labelCls}>
                Preferred date
                <input type="date" value={f.expDate} onChange={(e) => set("expDate", e.target.value)} className={controlCls} />
              </label>
              <label className={labelCls}>
                Experience or event
                <textarea rows={3} value={f.expPrefs} onChange={(e) => set("expPrefs", e.target.value)} placeholder="Event tickets, tours, yacht day or other plans" className={areaCls} />
              </label>
              <label className={labelCls}>
                Budget guidance (optional)
                <input type="text" value={f.expBudget} onChange={(e) => set("expBudget", e.target.value)} placeholder="A range helps us shortlist options" className={controlCls} />
              </label>
            </>
          )}
          <InfoNote>Availability, deposits and cancellation terms are confirmed by the supplier. Tickets and reservations are not guaranteed.</InfoNote>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-[10px]">
          <button type="button" onClick={back} className={`${linkBtn} !font-normal`}>
            {p.destFrom === "trip" ? "Back to trip preferences" : p.destFrom === "review" ? "Back to review" : "Back to concierge services"}
          </button>
          <button type="button" onClick={add} className={btnPrimary}>
            Add to trip request →
          </button>
        </div>
      </ModalBody>
    </Sheet>
  );
}

function SupportSheet() {
  const p = usePlanner();
  const [openIdx, setOpenIdx] = useState(-1);
  return (
    <Sheet open={p.dlg === "support"} onClose={p.close} width={600} labelledBy="cg-sup-title">
      <ModalBody onClose={p.close} closeLabel="Close support">
        <DialogTitle id="cg-sup-title" className="pr-[30px]">
          Let’s review the next step.
        </DialogTitle>
        <p className="mb-[14px] mt-1 text-[14px] text-steel">For an active trip, use the contact details in your booking confirmation.</p>
        <div className="flex items-center gap-[14px] border border-[#E8DFCF] bg-[#F6F0E6] px-4 py-[14px]">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
            <path d={PATHS.doc} />
          </svg>
          <div>
            <span className="block font-serif text-[19px]">Have your trip details ready</span>
            <span className="block text-[13px] text-steel">Booking reference · New timing · Affected services</span>
          </div>
        </div>
        <div className="mt-[10px] flex flex-col gap-2">
          {SUPPORT.map((s, i) => (
            <div key={s.t} className="border border-line">
              <button
                type="button"
                onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
                aria-expanded={openIdx === i}
                className="flex w-full cursor-pointer items-center gap-[14px] border-0 bg-transparent px-4 py-3 text-left text-bone"
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
                  <path d={s.d} />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[18px]">{s.t}</span>
                  <span className="block text-[13px] text-steel">{s.sub}</span>
                </span>
                <span aria-hidden="true" className={`text-steel transition-transform duration-150 ${openIdx === i ? "rotate-90" : ""}`}>
                  ›
                </span>
              </button>
              {openIdx === i ? <p className="m-0 pb-3 pl-[60px] pr-4 text-[13px] text-[#2F4654]">{s.b}</p> : null}
            </div>
          ))}
        </div>
        <InfoNote className="mt-3">The operator confirms flight feasibility. Revised services and costs require confirmation.</InfoNote>
        <div className="mt-[18px] flex flex-wrap justify-center gap-[10px]">
          <Link href="/guides/private-jet-disruptions-and-replacements" className={`${btnPrimary} !text-white`}>
            View recovery guide →
          </Link>
          <button type="button" onClick={p.close} className={btnSecondary}>
            Close
          </button>
        </div>
      </ModalBody>
    </Sheet>
  );
}
