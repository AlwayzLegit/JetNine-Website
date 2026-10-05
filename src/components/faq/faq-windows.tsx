"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { LightWindow } from "@/components/light/window";
import { submitContactInquiry } from "@/app/(marketing)/contact/actions";
import { SITE } from "@/lib/constants";
import { track } from "@/lib/analytics";
import { FaqIcon, IconDisc } from "./faq-icons";

export type FaqWindowName = "question" | "support" | "pets";
type Detail = { win: FaqWindowName; about?: string };

const EVENT = "jn:faq-window";

/** Open one of the FAQ windows from anywhere on the page. */
export function openFaqWindow(win: FaqWindowName, about?: string) {
  window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { win, about } }));
}

/** A button that opens an FAQ window (usable from server components). */
export function FaqWindowButton({
  win,
  about,
  className,
  children,
}: {
  win: FaqWindowName;
  about?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" className={`cursor-pointer ${className ?? ""}`} onClick={() => openFaqWindow(win, about)}>
      {children}
    </button>
  );
}

/**
 * The FAQ page's windows (jn-pack2-windows.js `faq:question`,
 * `faq:support`, `faq:pets`). Mounted once; opened through
 * `openFaqWindow`. "Ask JetNine" posts to the contact desk's real
 * server action (reason "other") so the question lands in the
 * dispatch inbox with the usual acknowledgement email.
 */
export function FaqWindows() {
  const [state, setState] = useState<Detail | null>(null);

  useEffect(() => {
    const on = (e: Event) => setState((e as CustomEvent<Detail>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  const close = () => setState(null);
  const win = state?.win;

  return (
    <LightWindow
      open={Boolean(state)}
      onClose={close}
      variant={win === "question" ? "modal" : "drawer"}
      title={win === "question" ? "Ask JetNine" : win === "support" ? "Help with an existing trip" : win === "pets" ? "Flying with pets" : undefined}
      sub={
        win === "question"
          ? "Tell us what you need to know."
          : win === "support"
            ? "Choose how to contact the team."
            : win === "pets"
              ? "Confirm the arrangements for your specific flight."
              : undefined
      }
    >
      {win === "question" ? <QuestionForm key={state?.about ?? "q"} about={state?.about} onClose={close} /> : null}
      {win === "support" ? <SupportPanel onClose={close} /> : null}
      {win === "pets" ? <PetsPanel onClose={close} onAsk={() => setState({ win: "question", about: "Pets" })} /> : null}
    </LightWindow>
  );
}

function QuestionForm({ about, onClose }: { about?: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const first = String(data.get("first") ?? "").trim();
    const last = String(data.get("last") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const question = String(data.get("question") ?? "").trim();
    if (!first || !last || !email || !question) {
      setMsg({ ok: false, text: "Please fill in your name, email and question." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg({ ok: false, text: "Check the email address." });
      return;
    }
    const payload = new FormData();
    payload.set("first", first);
    payload.set("last", last);
    payload.set("email", email);
    payload.set("reason", "other");
    payload.set("company", String(data.get("company") ?? ""));
    payload.set("notes", `FAQ question${about ? ` (about: ${about})` : ""}: ${question}`.slice(0, 2000));
    startTransition(async () => {
      const result = await submitContactInquiry(payload);
      if (result.ok) {
        track("contact_inquiry_submitted", { reason: "other", source: "faq" });
        setDone(true);
        setMsg({ ok: true, text: result.message });
      } else if (result.error === "RATE_LIMITED") {
        setMsg({ ok: false, text: "Too many sends — wait a few minutes, or call dispatch." });
      } else {
        setMsg({ ok: false, text: `Not sent. Try again, or call ${SITE.dispatchPhone}.` });
      }
    });
  }

  if (done) {
    return (
      <div className="mt-5">
        <p className="eyebrow">Noted</p>
        <p className="font-serif text-[22px] leading-[1.25]">Your question is with the desk.</p>
        <p className="mt-2 text-[14px] text-steel">{msg?.text} A request or question alone is not a booking.</p>
        <button type="button" onClick={onClose} className="btn btn-primary mt-5">
          Close
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="relative">
      {about ? (
        <span className="mt-3 inline-flex items-center rounded-pill bg-surface-2 px-3 py-[5px] text-[13px]">About: {about}</span>
      ) : null}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="faq-company">Company</label>
        <input id="faq-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="mt-[14px] text-right text-[12px] text-steel">
        <span className="text-danger">*</span> Required
      </p>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
          <div className="field-jn">
            <label htmlFor="faq-first">
              First name <span className="text-danger">*</span>
            </label>
            <input id="faq-first" name="first" autoComplete="given-name" required />
          </div>
          <div className="field-jn">
            <label htmlFor="faq-last">
              Last name <span className="text-danger">*</span>
            </label>
            <input id="faq-last" name="last" autoComplete="family-name" required />
          </div>
        </div>
        <div className="field-jn">
          <label htmlFor="faq-email">
            Email <span className="text-danger">*</span>
          </label>
          <input id="faq-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field-jn">
          <label htmlFor="faq-question">
            Your question <span className="text-danger">*</span>
          </label>
          <textarea
            id="faq-question"
            name="question"
            rows={4}
            maxLength={1800}
            required
            placeholder={
              about
                ? `Can you help confirm ${about.toLowerCase()} arrangements for my trip?`
                : "Ask in your own words — no aviation terms needed."
            }
          />
        </div>
      </div>
      <p className="mt-[6px] text-[12px] text-steel">Please leave out payment and passport details.</p>
      <p className="mt-3 border-t border-line pt-3 text-[13px] text-steel">
        See how we handle your information:{" "}
        <Link href="/legal" className="text-link">
          Privacy policy <span aria-hidden="true">↗</span>
        </Link>
      </p>
      {msg && !msg.ok ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {msg.text}
        </p>
      ) : null}
      <div className="mt-[14px] flex flex-col gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? "Sending…" : "Send question"} <span aria-hidden="true">→</span>
        </button>
        <button type="button" onClick={onClose} className="btn btn-secondary w-full">
          Cancel
        </button>
      </div>
    </form>
  );
}

function SupportPanel({ onClose }: { onClose: () => void }) {
  const [ref, setRef] = useState("");
  const [text, setText] = useState("");
  const subject = `Trip support${ref.trim() ? ` · ${ref.trim()}` : ""}`;
  const href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    `${ref.trim() ? `Booking reference: ${ref.trim()}\n\n` : ""}${text}`,
  )}`;

  return (
    <div>
      <div className="mt-4 grid grid-cols-[44px_minmax(0,1fr)] items-center gap-[14px] border border-[#EADFCB] bg-[#FBF5EC] px-4 py-[14px]">
        <IconDisc name="phone" size={44} />
        <div>
          <div className="text-[13px] text-steel">For time-sensitive changes, call the team.</div>
          <a href={`tel:${SITE.dispatchPhoneE164}`} className="font-serif text-[24px] text-bone">
            {SITE.dispatchPhone}
          </a>
        </div>
      </div>
      <div className="my-[14px] flex items-center gap-3 text-[12px] text-steel">
        <span className="h-px flex-1 bg-line" />
        Or prepare an email
        <span className="h-px flex-1 bg-line" />
      </div>
      <p className="text-[14px]">
        To:{" "}
        <a href={`mailto:${SITE.email}`} className="text-link">
          {SITE.email}
        </a>
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <div className="field-jn">
          <label htmlFor="faq-ref">Booking reference (optional)</label>
          <input id="faq-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
        <div className="field-jn">
          <label htmlFor="faq-help">What do you need help with?</label>
          <textarea id="faq-help" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>
      <p className="mt-[6px] text-[12px] text-steel">Review and send in your email app.</p>
      <div className="mt-[14px] flex flex-col gap-2">
        <a href={href} className="btn w-full border-gold bg-gold text-white hover:opacity-90">
          Open email draft <span aria-hidden="true">→</span>
        </a>
        <button type="button" onClick={onClose} className="btn btn-secondary w-full">
          Close
        </button>
      </div>
    </div>
  );
}

const PET_STEPS = [
  ["Share your pet’s details", "Species, size, carrier and any special needs."],
  ["Confirm aircraft acceptance", "Ask about cabin arrangements and applicable conditions."],
  ["Check destination requirements", "Review the documents needed for your itinerary."],
];

function PetsPanel({ onClose, onAsk }: { onClose: () => void; onAsk: () => void }) {
  return (
    <div>
      <ol className="mt-4 flex flex-col">
        {PET_STEPS.map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[40px_minmax(0,1fr)] gap-[14px] border-b border-surface-2 py-3">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-gold text-[12px] font-bold text-gold">
              0{i + 1}
            </span>
            <span>
              <b className="text-[15px]">{t}</b>
              <br />
              <span className="text-[13px] text-steel">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-[14px] grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3 bg-surface-2 px-[14px] py-3">
        <FaqIcon name="paw" className="h-6 w-6" />
        <div>
          <b className="text-[13px]">USDA APHIS · Pet travel</b>
          <br />
          <a href="https://www.aphis.usda.gov/pet-travel" target="_blank" rel="noopener noreferrer" className="text-link text-[13px]">
            Review official guidance <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" onClick={onAsk} className="btn btn-primary w-full">
          Ask about my pet <span aria-hidden="true">→</span>
        </button>
        <button type="button" onClick={onClose} className="btn btn-secondary w-full">
          Back to FAQ
        </button>
      </div>
    </div>
  );
}
