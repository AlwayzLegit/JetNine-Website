"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
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
  InfoNote,
  journeyLine,
  labelCls,
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

/* Light - Birthday party: two-step trip / celebration drawer, review and
   the birthday planning checklist. */

type Dlg = null | "trip" | "review" | "checklist";

const TILES = {
  Cake: PATHS.cake,
  Catering: "M3 18h18M5 18a7 7 0 0 1 14 0M12 11V9M10 9h4",
  Decorations: "M12 3a5 5 0 0 1 5 5c0 3.3-2.6 6-5 6s-5-2.7-5-6a5 5 0 0 1 5-5zM11 14h2l-1 2zM12 16c0 2-1.5 3-.5 5",
  Chauffeur: "M3 16v-4l2.5-5h13l2.5 5v4zM3 12h18M3 16v2h3v-2M18 16v2h3v-2",
} as const;
type Tile = keyof typeof TILES;
const TILE_KEYS = Object.keys(TILES) as Tile[];
const DRINKS = ["Champagne request", "Alcohol-free options"];
const DECOR = ["No decorations requested", "Discuss approved options"];

export const BIRTHDAY_CHECKS: CheckItem[] = [
  { t: "Guest count & passenger details", b: "Adults, children and special assistance." },
  { t: "Aircraft layout & baggage", b: "Confirm actual seats and storage." },
  { t: "Menu, cake & allergies", b: "Check dimensions, serving and dietary needs." },
  { t: "Operator-approved decorations", b: "Agree materials, placement and removal." },
  { t: "Itemized total & supplier terms", b: "Confirm extras, deposits and cancellation." },
  { t: "Transfers & backup plan", b: "Agree pickup details and a trip contact." },
];

const EMPTY = {
  from: "", to: "", type: "round" as TripType, date: "", ret: "", time: "", stops: "", adults: "6", children: "0", needs: "",
  menu: "", allergies: "", decor: DECOR[1],
};
type Fields = typeof EMPTY;

function usePlannerState() {
  const [dlg, setDlg] = useState<Dlg>(null);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [f, setF] = useState<Fields>(EMPTY);
  const [svc, setSvc] = useState<Partial<Record<Tile, boolean>>>({});
  const [drinks, setDrinks] = useState<Record<string, boolean>>({});
  const [surprise, setSurprise] = useState(false);
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [contact, setContactState] = useState<Contact>({ name: "", email: "", contact: "Email", phone: "" });
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
  const children = Math.max(0, parseInt(f.children, 10) || 0);
  const tripErr = () => validateTrip({ ...f, adults }, "adult passenger");
  const open = (d: Exclude<Dlg, null>) => {
    setErr("");
    if (d === "trip") setStep(0);
    setDlg(d);
  };
  const close = () => {
    setDlg(null);
    setErr("");
  };

  return {
    dlg, setDlg, step, setStep, err, setErr, sent, setSent, f, set, svc, setSvc, drinks, setDrinks, surprise, setSurprise,
    checks, setChecks, contact, setContact, pending, startTransition, adults, children, tripErr, open, close,
  };
}

type Planner = ReturnType<typeof usePlannerState>;
const Ctx = createContext<Planner | null>(null);

function usePlanner(): Planner {
  const p = useContext(Ctx);
  if (!p) throw new Error("Birthday planner controls must sit inside <BirthdayProvider>.");
  return p;
}

export function BirthdayProvider({ children }: { children: ReactNode }) {
  const p = usePlannerState();
  useScrollLock(p.dlg !== null);
  return (
    <Ctx.Provider value={p}>
      {children}
      <TripSheet />
      <ReviewSheet />
      <ChecklistSheet />
    </Ctx.Provider>
  );
}

export function BirthdayButton({ open, className, children }: { open: "trip" | "checklist"; className: string; children: ReactNode }) {
  const p = usePlanner();
  return (
    <button type="button" onClick={() => p.open(open)} className={className}>
      {children}
    </button>
  );
}

function guestsLine(p: Planner) {
  return `${plural(p.adults, "adult", "adults")}${p.children ? `, ${plural(p.children, "child", "children")}` : ""}`;
}

/* ---------------- Sidebar "Plan your birthday trip" box ---------------- */

export function BirthdaySidebarForm() {
  const p = usePlanner();
  const { f, set } = p;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,110px),1fr))]">
        <label className={labelCls}>
          From
          <input type="text" value={f.from} onChange={(e) => set("from", e.target.value)} placeholder="Airport or city" className={controlCls} />
        </label>
        <label className={labelCls}>
          To
          <input type="text" value={f.to} onChange={(e) => set("to", e.target.value)} placeholder="Airport or city" className={controlCls} />
        </label>
      </div>
      <div className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,110px),1fr))]">
        <label className={labelCls}>
          Travel date
          <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={controlCls} />
        </label>
        <label className={labelCls}>
          Guests
          <input type="number" min={1} value={f.adults} onChange={(e) => set("adults", e.target.value)} className={controlCls} />
        </label>
      </div>
      <label className={labelCls}>
        Trip type
        <select value={f.type} onChange={(e) => set("type", e.target.value as TripType)} className={controlCls}>
          <option value="round">Round trip</option>
          <option value="one">One way</option>
          <option value="multi">Multi-city</option>
        </select>
      </label>
      <div role="group" aria-label="Celebration requests">
        <span className="mb-2 block text-[12px] font-bold">Celebration requests</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {TILE_KEYS.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" checked={!!p.svc[t]} onChange={() => p.setSvc((s) => ({ ...s, [t]: !s[t] }))} className={checkCls} />
              {t}
            </label>
          ))}
        </div>
      </div>
      <label className={labelCls}>
        Special requirements
        <textarea rows={2} value={f.needs} onChange={(e) => set("needs", e.target.value)} placeholder="Dietary needs, children, baggage or mobility" className={areaCls} />
      </label>
      <button type="button" onClick={() => p.open("trip")} className={btnPrimary}>
        Build my request →
      </button>
      <p className="m-0 text-[12px] text-steel">An inquiry does not confirm availability or a booking.</p>
    </div>
  );
}

/* ---------------- Windows ---------------- */

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
  const guests = p.adults + p.children;

  return (
    <Sheet open={p.dlg === "trip"} onClose={p.close} variant="drawer" labelledBy="bd-trip-title">
      <DrawerFrame
        titleId="bd-trip-title"
        title={step === 0 ? "Plan your birthday trip" : "Make it your celebration"}
        sub={step === 0 ? "Start with the journey. We’ll help shape the celebration." : "Tell us what will make it special. We’ll take care of the details."}
        steps={["Trip", "Celebration", "Review"]}
        step={step}
        onClose={p.close}
        footer={
          <>
            <ErrorLine err={p.err} />
            {step === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-[10px]">
                <span className="flex-[1_1_160px] text-[12px] text-steel">Aircraft and services remain subject to confirmation.</span>
                <button type="button" onClick={goStep1} className={btnPrimary}>
                  Continue to celebration →
                </button>
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
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
              <label className={labelCls}>
                From
                <input type="text" value={f.from} onChange={(e) => set("from", e.target.value)} placeholder="Airport or city" className={controlCls} />
              </label>
              <label className={labelCls}>
                To
                <input type="text" value={f.to} onChange={(e) => set("to", e.target.value)} placeholder="Airport or city" className={controlCls} />
              </label>
            </div>
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 p-0 text-[12px] font-bold">Trip type</legend>
              <div className="flex flex-wrap gap-x-[22px] gap-y-2">
                {(["one", "round", "multi"] as const).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 text-[14px]">
                    <input
                      type="radio"
                      name="bd-trip-type"
                      checked={f.type === k}
                      onChange={() => set("type", k)}
                      className="m-0 h-[18px] w-[18px] accent-[var(--bone)]"
                    />
                    {TRIP_LABEL[k]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
              <label className={labelCls}>
                Departure date
                <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={controlCls} />
              </label>
              {f.type === "round" ? (
                <label className={labelCls}>
                  Return date
                  <input type="date" value={f.ret} onChange={(e) => set("ret", e.target.value)} className={controlCls} />
                </label>
              ) : null}
            </div>
            <p className="-mt-[6px] text-[12px] text-steel">Still flexible? Leave dates blank and discuss them with your advisor.</p>
            <label className={labelCls}>
              Preferred departure time (local)
              <input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} className={controlCls} />
            </label>
            {f.type === "multi" ? (
              <label className={labelCls}>
                Additional stops and dates
                <textarea rows={3} value={f.stops} onChange={(e) => set("stops", e.target.value)} placeholder="List each additional city and preferred timing" className={areaCls} />
              </label>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <label className={labelCls}>
                Adults
                <input type="number" min={1} value={f.adults} onChange={(e) => set("adults", e.target.value)} className={controlCls} />
              </label>
              <label className={labelCls}>
                Children
                <input type="number" min={0} value={f.children} onChange={(e) => set("children", e.target.value)} className={controlCls} />
              </label>
            </div>
            <label className={labelCls}>
              Baggage &amp; mobility needs
              <textarea rows={3} value={f.needs} onChange={(e) => set("needs", e.target.value)} placeholder="Tell us about any special requirements" className={areaCls} />
            </label>
            <div aria-live="polite" className="flex items-center gap-3 bg-bone px-4 py-3 text-[14px] text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d={PATHS.people} />
              </svg>
              <span>
                {plural(guests, "guest", "guests")} · {TRIP_LABEL[f.type]}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[14px]">
            <div className="relative aspect-[16/7] overflow-hidden bg-[#ECE8DF]">
              <Image
                src="/images/concierge/birthday-cake.webp"
                alt="Birthday cake and catering in a private jet cabin."
                fill
                sizes="460px"
                className="object-cover"
                style={{ objectPosition: "center 55%" }}
              />
            </div>
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-[10px] p-0 font-serif text-[19px]">What would you like to include?</legend>
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(96px,1fr))]">
                {TILE_KEYS.map((t) => {
                  const on = !!p.svc[t];
                  return (
                    <label key={t} className={`flex cursor-pointer flex-col gap-2 border px-3 py-[10px] text-[13px] ${on ? "border-bone bg-ink" : "border-line bg-white"}`}>
                      <span className="flex items-center justify-between">
                        <input type="checkbox" checked={on} onChange={() => p.setSvc((s) => ({ ...s, [t]: !s[t] }))} className={checkCls} />
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={TILES[t]} />
                        </svg>
                      </span>
                      {t}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
              <div className="flex min-w-0 flex-col gap-[14px]">
                <label className={labelCls}>
                  Cake &amp; menu preferences
                  <input type="text" value={f.menu} onChange={(e) => set("menu", e.target.value)} placeholder="Small vanilla cake; light sharing menu" className={controlCls} />
                </label>
                <label className={labelCls}>
                  Allergies &amp; dietary requirements
                  <input type="text" value={f.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Tell us what the caterer must know" className={controlCls} />
                </label>
              </div>
              <div className="flex min-w-0 flex-col gap-[14px]">
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-2 p-0 text-[12px] font-bold">Beverage options</legend>
                  <div className="flex flex-col gap-2">
                    {DRINKS.map((d) => (
                      <label key={d} className="flex cursor-pointer items-center gap-2 text-[13px]">
                        <input type="checkbox" checked={!!p.drinks[d]} onChange={() => p.setDrinks((s) => ({ ...s, [d]: !s[d] }))} className={checkCls} />
                        {d}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className={labelCls}>
                  Decorations
                  <select value={f.decor} onChange={(e) => set("decor", e.target.value)} className={controlCls}>
                    {DECOR.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" checked={p.surprise} onChange={() => p.setSurprise((s) => !s)} className={checkCls} />
              This is a surprise. Contact the organizer only.
            </label>
            <InfoNote>Cake storage, decoration materials and beverage service require operator confirmation.</InfoNote>
          </div>
        )}
      </DrawerFrame>
    </Sheet>
  );
}

function celebrationLine(p: Planner) {
  const svcOn = TILE_KEYS.filter((k) => p.svc[k] && k !== "Chauffeur");
  const drOn = DRINKS.filter((d) => p.drinks[d]);
  const items = [...svcOn, ...drOn].join(", ");
  return `${items}${p.surprise ? `${items ? "; " : ""}surprise` : ""}`.trim();
}

function ReviewSheet() {
  const p = usePlanner();
  const { f } = p;
  const toTrip = (step: number) => () => {
    p.setErr("");
    p.setStep(step);
    p.setDlg("trip");
  };
  const rows = [
    { k: "Journey", v: journeyLine(f), onEdit: toTrip(0) },
    { k: "Guests", v: guestsLine(p), onEdit: toTrip(0) },
    { k: "Dates", v: datesLine(f), onEdit: toTrip(0) },
    { k: "Celebration", v: celebrationLine(p) || "Nothing selected yet", onEdit: toTrip(1) },
    { k: "Ground transport", v: p.svc.Chauffeur ? "Chauffeur requested" : "Not requested", onEdit: toTrip(1) },
  ];

  const send = () => {
    const e = validateContact(p.contact);
    if (e) return p.setErr(e);
    p.setErr("");
    p.startTransition(async () => {
      const failure = await sendPlannerInquiry({
        source: "birthday",
        contact: p.contact,
        from: f.from,
        to: f.to,
        date: f.date ? datesLine(f) : "",
        pax: guestsLine(p),
        lines: [
          ["Trip type", TRIP_LABEL[f.type]],
          ["Journey", journeyLine(f)],
          ["Dates", datesLine(f)],
          ["Guests", guestsLine(p)],
          ["Celebration", celebrationLine(p)],
          ["Ground transport", p.svc.Chauffeur ? "Chauffeur requested" : ""],
          ["Cake & menu", f.menu],
          ["Allergies & dietary", f.allergies],
          ["Decorations", f.decor],
          ["Baggage & mobility", f.needs],
          ["Surprise", p.surprise ? "Yes — contact the organizer only" : ""],
          ["Preferred contact", p.contact.contact],
        ],
      });
      if (failure) p.setErr(failure);
      else p.setSent(true);
    });
  };

  return (
    <Sheet open={p.dlg === "review"} onClose={p.close} width={620} labelledBy="bd-review-title">
      <ReviewPanel
        titleId="bd-review-title"
        title="Review your birthday request"
        rows={rows}
        contact={p.contact}
        setContact={p.setContact}
        radioName="bd-contact"
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
  return (
    <Sheet open={p.dlg === "checklist"} onClose={p.close} width={560} labelledBy="bd-check-title">
      <ModalBody onClose={p.close} closeLabel="Close checklist">
        <DialogTitle id="bd-check-title" className="pr-[30px]">
          Ready for the celebration?
        </DialogTitle>
        <p className="mb-[14px] mt-1 text-[14px] text-steel">Review these details with your advisor.</p>
        <ChecklistBody items={BIRTHDAY_CHECKS} done={p.checks} toggle={(i) => p.setChecks((s) => ({ ...s, [i]: !s[i] }))} progressWord="complete" />
        <div className="mt-[18px] grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          <button
            type="button"
            onClick={() => printChecklist("Ready for the celebration?", "JetNine birthday planning checklist", BIRTHDAY_CHECKS, p.checks)}
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
