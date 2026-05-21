"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createOperator } from "@/app/admin/operators/[id]/actions";

const ARGUS = [
  { id: "platinum", label: "Platinum" },
  { id: "gold", label: "Gold" },
  { id: "silver", label: "Silver" },
  { id: "none", label: "Not rated" },
] as const;

export function OperatorCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);

    startTransition(async () => {
      const result = await createOperator(data);
      if (result.ok) {
        setMsg({ tone: "ok", text: "ADDED — opening detail." });
        form.reset();
        router.push(`/admin/operators/${result.id}`);
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary btn-sm"
      >
        + Add operator <span className="arrow">→</span>
      </button>
    );
  }

  return (
    <div className="rounded-[4px] border border-clearance bg-ink-2 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="caption text-clearance">— Add operator</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMsg(null);
          }}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 hover:text-bone"
        >
          Close ✕
        </button>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="oc-name">Operator name</label>
            <input
              id="oc-name"
              name="name"
              type="text"
              placeholder="Northwind Air Charter"
              required
              maxLength={140}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="oc-cert">FAA cert number</label>
            <input id="oc-cert" name="certNumber" type="text" placeholder="WXYZ123A" maxLength={40} />
          </div>
          <div className="field-jn">
            <label htmlFor="oc-part">FAA part</label>
            <input
              id="oc-part"
              name="faaPart"
              type="text"
              defaultValue="135"
              placeholder="135"
              maxLength={8}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="oc-home">Home base (ICAO)</label>
            <input
              id="oc-home"
              name="homeAirportIcao"
              type="text"
              placeholder="KTEB"
              maxLength={4}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="oc-argus">ARG/US rating</label>
            <select id="oc-argus" name="argusRating" defaultValue="none">
              {ARGUS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex h-full cursor-pointer items-center gap-3 rounded-[2px] border border-ink-3 bg-ink p-4">
            <input type="checkbox" name="wyvernWingman" className="h-4 w-4 accent-clearance" />
            <span className="font-serif text-[14px] text-bone">Wyvern Wingman</span>
          </label>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-[2px] border border-ink-3 bg-ink p-4">
          <input type="checkbox" name="isPreferred" className="h-4 w-4 accent-clearance" />
          <div>
            <div className="font-serif text-[14px] text-bone">Preferred partner</div>
            <div className="mt-1 text-[12px] leading-[1.5] text-bone-2">
              Sorts first on workbench candidates. Toggle later if needed.
            </div>
          </div>
        </label>

        <input type="hidden" name="status" value="active" />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {msg ? (
            <span
              className={[
                "font-mono text-[11px] uppercase tracking-[0.12em]",
                msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
              ].join(" ")}
            >
              {msg.text}
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              — Open the operator after creating to fill in renewals, terms, contacts.
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add operator"} <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
