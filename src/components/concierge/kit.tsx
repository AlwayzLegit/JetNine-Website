"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { submitContactInquiry } from "@/app/(marketing)/contact/actions";
import { track } from "@/lib/analytics";
import { SITE } from "@/lib/constants";

/*
 * Shared pieces for the Concierge and Birthday planners (Light - Concierge,
 * Light - Birthday party): a native <dialog> sheet, form controls, the step
 * rail, the review / sent panels and the pre-travel checklist. Both
 * planners send through the contact inquiry action, so requests land on
 * the desk (/admin/messages) like any other quote request.
 */

import { areaCls, btnPrimary, btnSecondary, checkCls, controlCls, labelCls, linkBtn } from "./styles";

export { areaCls, btnPrimary, btnSecondary, checkCls, controlCls, labelCls, linkBtn };

export type TripType = "one" | "round" | "multi";
export const TRIP_LABEL: Record<TripType, string> = { one: "One way", round: "Round trip", multi: "Multi-city" };

export function fmtDate(d: string): string {
  if (!d) return "";
  const x = new Date(`${d}T00:00`);
  return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Trip-step validation shared by both planners (prototype copy). */
export function validateTrip(t: {
  from: string;
  to: string;
  adults: number;
  type: TripType;
  stops: string;
  date: string;
  ret: string;
}, adultWord = "passenger"): string {
  if (!t.from.trim() || !t.to.trim()) return "Add where you’re flying from and to.";
  if (t.adults < 1) return `Add at least one ${adultWord}.`;
  if (t.type === "multi" && !t.stops.trim()) return "List the additional stops for a multi-city trip.";
  if (t.type === "round" && t.date && t.ret && t.ret < t.date) return "The return date must be after the departure date.";
  return "";
}

export function journeyLine(t: { from: string; to: string; type: TripType; stops: string }) {
  const arrow = t.type === "round" ? " ↔ " : " → ";
  const extra = t.type === "multi" && t.stops.trim() ? ` + ${t.stops.trim().split(/\n+/).join(", ")}` : "";
  return `${t.from || "—"}${arrow}${t.to || "—"}${extra}`;
}

export function datesLine(t: { date: string; ret: string; time: string; type: TripType }) {
  if (!t.date) return "To be discussed";
  return `${fmtDate(t.date)}${t.type === "round" && t.ret ? ` – ${fmtDate(t.ret)}` : ""}${t.time ? `, ${t.time}` : ""}`;
}

export type Contact = { name: string; email: string; contact: "Email" | "Phone"; phone: string };

export function validateContact(c: Contact): string {
  if (!c.name.trim()) return "Add the organizer’s name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) return "Add a valid email address.";
  if (c.contact === "Phone" && c.phone.replace(/\D/g, "").length < 7) return "Add a phone number, or choose email.";
  return "";
}

/**
 * Sends a planner request as a "quote" contact inquiry. The organizer name
 * is split into first / last (the action needs both); the planner details
 * go into the notes, prefixed with the page so the desk can tell them apart.
 */
export async function sendPlannerInquiry(opts: {
  source: "concierge" | "birthday";
  contact: Contact;
  from: string;
  to: string;
  date: string;
  pax: string;
  lines: [string, string][];
}): Promise<string> {
  const [first, ...rest] = opts.contact.name.trim().split(/\s+/);
  const heading = opts.source === "concierge" ? "[Concierge request]" : "[Birthday request]";
  const notes = [heading, ...opts.lines.filter(([, v]) => v.trim()).map(([k, v]) => `${k}: ${v.trim()}`)]
    .join("\n")
    .slice(0, 2000);
  const data = new FormData();
  data.set("reason", "quote");
  data.set("first", first);
  data.set("last", rest.join(" ") || "—");
  data.set("email", opts.contact.email.trim());
  data.set("mobile", opts.contact.contact === "Phone" ? opts.contact.phone.trim() : "");
  data.set("from", opts.from.trim());
  data.set("to", opts.to.trim());
  // Dates are optional here ("leave dates blank"); the action requires a
  // date for quote requests, so a blank one is sent as "Flexible".
  data.set("date", opts.date || "Flexible");
  data.set("pax", opts.pax);
  data.set("notes", notes);
  try {
    const result = await submitContactInquiry(data);
    if (result.ok) {
      track("contact_inquiry_submitted", { reason: "quote", source: opts.source });
      return "";
    }
    if (result.error === "RATE_LIMITED") return `Too many sends — wait a few minutes, or call ${SITE.dispatchPhone}.`;
  } catch {
    // Network or server failure: fall through to the generic message.
  }
  return `Not sent. Try again, or call ${SITE.dispatchPhone}.`;
}

/**
 * A native <dialog> shown as a right-edge drawer or a centred modal. Escape
 * and backdrop clicks call `onClose`; closing because another sheet opened
 * does not (only `cancel` is handled, never `close`).
 */
export function Sheet({
  open,
  onClose,
  variant = "modal",
  width = 600,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  variant?: "drawer" | "modal";
  width?: number;
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      requestAnimationFrame(() => d.querySelector<HTMLElement>("[data-dlg-title]")?.focus());
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
      }}
      style={variant === "modal" ? { width: `min(${width}px, calc(100% - 32px))` } : undefined}
      className={[
        "light-window m-0 max-w-none border-0 bg-white p-0 text-[15px] leading-[1.5] text-bone backdrop:bg-[rgba(18,35,46,0.55)]",
        variant === "drawer"
          ? "ml-auto h-dvh max-h-none w-[min(500px,100%)] flex-col shadow-[-12px_0_40px_rgba(18,35,46,0.18)] open:flex"
          : "mx-auto my-4 max-h-[calc(100dvh-32px)] overflow-y-auto shadow-[0_20px_60px_rgba(18,35,46,0.25)] sm:my-auto",
      ].join(" ")}
    >
      {open ? children : null}
    </dialog>
  );
}

export function CloseX({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-3 top-3 h-9 w-9 cursor-pointer border-0 bg-transparent text-[24px] leading-none text-gold"
    >
      ×
    </button>
  );
}

export function DialogTitle({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} data-dlg-title="" tabIndex={-1} className={`m-0 font-serif text-[28px] font-normal leading-[1.1] outline-none ${className}`}>
      {children}
    </h2>
  );
}

/** Body of a modal sheet: padding plus the close button. */
export function ModalBody({ onClose, closeLabel, children }: { onClose: () => void; closeLabel: string; children: ReactNode }) {
  return (
    <div className="relative px-7 pb-6 pt-[26px] max-sm:px-5">
      <CloseX onClick={onClose} label={closeLabel} />
      {children}
    </div>
  );
}

export function InfoNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex gap-[10px] border border-[#E8DFCF] bg-[#F6F0E6] px-[14px] py-[10px] text-[13px] ${className}`}>
      <span
        aria-hidden="true"
        className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-[1.5px] border-gold font-serif text-[11px] font-bold text-gold"
      >
        i
      </span>
      <span>{children}</span>
    </div>
  );
}

export function ErrorLine({ err, className = "" }: { err: string; className?: string }) {
  return err ? (
    <p role="alert" className={`m-0 text-[13px] text-[#A23B2A] ${className}`}>
      {err}
    </p>
  ) : null;
}

export function StepRail({ labels, step }: { labels: string[]; step: number }) {
  return (
    <ol aria-label="Planning steps" className="m-0 flex list-none items-center gap-2 p-0 text-[12px]">
      {labels.map((label, i) => {
        const cur = i === step;
        const past = i < step;
        const last = i === labels.length - 1;
        return (
          <li key={label} aria-current={cur ? "step" : undefined} className={`flex items-center gap-2 ${last ? "flex-none" : "flex-1"}`}>
            <span
              className={[
                "flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[12px]",
                cur ? "border-bone bg-bone text-white" : past ? "border-bone bg-white text-bone" : "border-line bg-white text-steel",
              ].join(" ")}
            >
              {i + 1}
            </span>
            <span className={`whitespace-nowrap ${cur ? "font-bold text-bone" : "text-steel"}`}>{label}</span>
            {last ? null : <span aria-hidden="true" className="h-px flex-1 bg-line" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Right-edge planner drawer: header (title, sub, steps), scrolling body, footer. */
export function DrawerFrame({
  titleId,
  title,
  sub,
  steps,
  step,
  onClose,
  footer,
  children,
}: {
  titleId: string;
  title: string;
  sub: string;
  steps: string[];
  step: number;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="relative border-b border-[#ECE8DF] px-6 pb-[14px] pt-[22px]">
        <CloseX onClick={onClose} label="Close trip planner" />
        <DialogTitle id={titleId} className="pr-10">
          {title}
        </DialogTitle>
        <p className="mb-[14px] mt-1 text-[13px] text-steel">{sub}</p>
        <StepRail labels={steps} step={step} />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-[18px]">{children}</div>
      <div className="flex flex-col gap-2 border-t border-[#ECE8DF] px-6 py-[14px]">{footer}</div>
    </>
  );
}

export type ReviewRow = { k: string; v: string; onEdit: () => void };

/** Review modal (not yet sent) and the thank-you state once sent. */
export function ReviewPanel({
  titleId,
  title,
  rows,
  contact,
  setContact,
  radioName,
  err,
  pending,
  sent,
  onBack,
  onSend,
  onChecklist,
  onClose,
}: {
  titleId: string;
  title: string;
  rows: ReviewRow[];
  contact: Contact;
  setContact: (patch: Partial<Contact>) => void;
  radioName: string;
  err: string;
  pending: boolean;
  sent: boolean;
  onBack: () => void;
  onSend: () => void;
  onChecklist: () => void;
  onClose: () => void;
}) {
  if (sent) {
    const first = contact.name.trim().split(/\s+/)[0];
    return (
      <ModalBody onClose={onClose} closeLabel="Close review">
        <div role="status" className="pb-1 pr-[30px] pt-2">
          <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-bone text-[20px] text-white">
            ✓
          </span>
          <DialogTitle id={titleId} className="mt-4">
            Thank you. Your request is with us.
          </DialogTitle>
          <p className="mt-2 text-[15px] text-[#2F4654]">
            Thank you{first ? `, ${first}` : ""}. Your advisor will review the options and reply by {contact.contact === "Phone" ? "phone." : "email."}
          </p>
          <p className="mt-2 text-[13px] text-steel">
            Nothing is booked yet. Your advisor will confirm availability, operator approvals, pricing and terms.
          </p>
          <div className="mt-5 flex flex-wrap gap-[10px]">
            <button type="button" onClick={onChecklist} className={btnSecondary}>
              Open planning checklist
            </button>
            <button type="button" onClick={onClose} className={btnPrimary}>
              Done
            </button>
          </div>
        </div>
      </ModalBody>
    );
  }

  return (
    <ModalBody onClose={onClose} closeLabel="Close review">
      <div className="flex flex-wrap items-center gap-x-[14px] gap-y-2 pr-[30px]">
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <span className="whitespace-nowrap rounded-full bg-[#F6E7D6] px-3 py-[3px] text-[12px] text-[#7A4A1E]">Not yet submitted</span>
      </div>
      <p className="mb-4 mt-1 text-[14px] text-steel">Check your details before sending an inquiry.</p>
      <dl className="m-0 border border-line">
        {rows.map((r, i) => (
          <div
            key={r.k}
            className={`grid grid-cols-[minmax(90px,130px)_minmax(0,1fr)_auto] items-baseline gap-3 px-[14px] py-[9px] ${i ? "border-t border-line" : ""}`}
          >
            <dt className="text-[13px] font-bold">{r.k}</dt>
            <dd className="m-0 min-w-0 break-words text-[14px] text-[#2F4654]">{r.v}</dd>
            <button type="button" onClick={r.onEdit} aria-label={`Edit ${r.k.toLowerCase()}`} className={`${linkBtn} !font-normal`}>
              Edit
            </button>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <label className={labelCls}>
          Organizer name
          <input
            type="text"
            value={contact.name}
            onChange={(e) => setContact({ name: e.target.value })}
            placeholder="Your name"
            autoComplete="name"
            className={controlCls}
          />
        </label>
        <label className={labelCls}>
          Email
          <input
            type="email"
            value={contact.email}
            onChange={(e) => setContact({ email: e.target.value })}
            placeholder="you@example.com"
            autoComplete="email"
            className={controlCls}
          />
        </label>
      </div>
      <fieldset className="m-0 mt-[14px] flex flex-wrap items-center gap-x-[22px] gap-y-2 border-0 p-0">
        <legend className="float-left mr-[10px] p-0 text-[12px] font-bold">Preferred contact</legend>
        {(["Email", "Phone"] as const).map((c) => (
          <label key={c} className="flex cursor-pointer items-center gap-2 text-[14px]">
            <input
              type="radio"
              name={radioName}
              checked={contact.contact === c}
              onChange={() => setContact({ contact: c })}
              className="m-0 h-[18px] w-[18px] accent-[var(--bone)]"
            />
            {c}
          </label>
        ))}
      </fieldset>
      {contact.contact === "Phone" ? (
        <label className={`${labelCls} mt-3`}>
          Phone number
          <input
            type="tel"
            value={contact.phone}
            onChange={(e) => setContact({ phone: e.target.value })}
            autoComplete="tel"
            className={controlCls}
          />
        </label>
      ) : null}
      <InfoNote className="mt-4">
        This is an inquiry, not a booking. Your advisor will confirm availability, operator approvals, pricing and terms.
      </InfoNote>
      <ErrorLine err={err} className="mt-3" />
      <div className="mt-4 grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        <button type="button" onClick={onBack} className={btnSecondary}>
          Back to edit
        </button>
        <button type="button" onClick={onSend} disabled={pending} aria-busy={pending || undefined} className={`${btnPrimary} disabled:opacity-60`}>
          {pending ? "Sending…" : "Send inquiry →"}
        </button>
      </div>
    </ModalBody>
  );
}

export type CheckItem = { short?: string; t: string; b: string };

export function printChecklist(title: string, docTitle: string, items: CheckItem[], done: Record<number, boolean>) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  const w = window.open("", "_blank");
  if (!w) {
    window.print();
    return;
  }
  w.document.write(
    `<title>${esc(docTitle)}</title><body style="font:15px Arial;padding:32px;color:#12232E"><h1 style="font:400 28px 'Times New Roman'">${esc(title)}</h1>` +
      items
        .map((c, i) => `<p>${done[i] ? "☑" : "☐"} <b>${esc(c.t)}</b><br><span style="color:#56616A">${esc(c.b)}</span></p>`)
        .join("") +
      "</body>",
  );
  w.document.close();
  w.focus();
  w.print();
}

/** Progress bar + checklist rows. `expand` shows the detail on demand. */
export function ChecklistBody({
  items,
  done,
  toggle,
  expand = false,
  openIdx,
  setOpenIdx,
  progressWord,
}: {
  items: CheckItem[];
  done: Record<number, boolean>;
  toggle: (i: number) => void;
  expand?: boolean;
  openIdx?: number;
  setOpenIdx?: (i: number) => void;
  progressWord: string;
}) {
  const count = items.filter((_, i) => done[i]).length;
  const pct = `${Math.round((count / items.length) * 100)}%`;
  return (
    <>
      <div className="flex items-center gap-4">
        <div className="h-[6px] flex-1 overflow-hidden rounded-[3px] bg-[#ECE8DF]">
          <div className="h-full bg-gold transition-[width] duration-200" style={{ width: pct }} />
        </div>
        <span aria-live="polite" className="whitespace-nowrap text-[13px]">
          {count} of {items.length} {progressWord}
        </span>
      </div>
      <div className="mt-[14px] flex flex-col gap-2">
        {items.map((c, i) =>
          expand ? (
            <div key={c.t} className="border border-line">
              <div className="flex items-center gap-3 px-[14px] py-[10px]">
                <input
                  type="checkbox"
                  aria-label={c.t}
                  checked={!!done[i]}
                  onChange={() => toggle(i)}
                  className="m-0 h-[18px] w-[18px] flex-none accent-[var(--bone)]"
                />
                <button
                  type="button"
                  onClick={() => setOpenIdx?.(openIdx === i ? -1 : i)}
                  aria-expanded={openIdx === i}
                  className="flex flex-1 cursor-pointer items-center justify-between gap-[10px] border-0 bg-transparent p-0 text-left text-[14px] text-bone"
                >
                  <span>{c.t}</span>
                  <span aria-hidden="true" className={`text-steel transition-transform duration-150 ${openIdx === i ? "rotate-90" : ""}`}>
                    ›
                  </span>
                </button>
              </div>
              {openIdx === i ? <p className="m-0 pb-[10px] pl-11 pr-[14px] text-[13px] text-steel">{c.b}</p> : null}
            </div>
          ) : (
            <label key={c.t} className="flex cursor-pointer items-start gap-3 border border-line px-[14px] py-[10px]">
              <input
                type="checkbox"
                checked={!!done[i]}
                onChange={() => toggle(i)}
                className="m-0 mt-[2px] h-[18px] w-[18px] flex-none accent-[var(--gold)]"
              />
              <span className="flex flex-col">
                <span className="text-[14px] font-bold">{c.t}</span>
                <span className="text-[13px] text-steel">{c.b}</span>
              </span>
            </label>
          ),
        )}
      </div>
    </>
  );
}

/** Locks page scroll while any planner sheet is open. */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}
