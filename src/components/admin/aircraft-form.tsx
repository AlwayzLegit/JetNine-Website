"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createAircraft, updateAircraft } from "@/app/admin/aircraft/[id]/actions";
import type { Aircraft } from "@/db/schema/aircraft";

export type OperatorOption = { id: string; name: string };

const CATEGORIES = [
  { id: "turboprop", label: "Turboprop" },
  { id: "light", label: "Light" },
  { id: "midsize", label: "Midsize" },
  { id: "supermid", label: "Super-mid" },
  { id: "heavy", label: "Heavy" },
  { id: "ulr", label: "Ultra long range" },
] as const;

const WIFIS = [
  { id: "none", label: "None" },
  { id: "aircell", label: "Aircell" },
  { id: "gogo", label: "Gogo" },
  { id: "ka", label: "Ka-band" },
  { id: "yes", label: "Generic" },
] as const;

const STATUSES = [
  { id: "available", label: "Available" },
  { id: "aog", label: "AOG — out of service" },
  { id: "maint", label: "Maintenance" },
  { id: "sold", label: "Sold / retired" },
] as const;

const CABIN_FIELDS: { name: keyof Aircraft; label: string; desc: string }[] = [
  { name: "standupCabin", label: "Stand-up cabin", desc: "Midsize+ typically." },
  { name: "lavatoryEnclosed", label: "Enclosed lavatory", desc: "Standard midsize+." },
  { name: "lieflatCapable", label: "Lie-flat seating", desc: "Heavy / ULR only." },
  { name: "petFriendly", label: "Pet-friendly", desc: "In-cabin, no carrier." },
  { name: "flightAttendantStandard", label: "FA standard", desc: "Crewed by default." },
];

/**
 * Used in two modes:
 * - mode='create': renders an inline-expanding compact form. Required fields
 *   only. On success, navigates to the new aircraft's detail page.
 * - mode='edit': full editor, always-visible. Updates existing row in place.
 */
export function AircraftForm({
  mode,
  operatorOptions,
  initial,
}: {
  mode: "create" | "edit";
  operatorOptions: OperatorOption[];
  initial?: Aircraft;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === "edit");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);

    startTransition(async () => {
      if (mode === "create") {
        const result = await createAircraft(data);
        if (result.ok) {
          setMsg({ tone: "ok", text: `ADDED — ${result.tailNumber}` });
          form.reset();
          router.push(`/admin/aircraft/${result.id}`);
        } else {
          setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
        }
      } else {
        const result = await updateAircraft(initial!.id, data);
        if (result.ok) {
          setMsg({ tone: "ok", text: "SAVED." });
        } else {
          setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
        }
      }
    });
  }

  if (mode === "create" && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary btn-sm"
      >
        + Add aircraft <span className="arrow">→</span>
      </button>
    );
  }

  return (
    <div
      className={[
        "rounded-[4px] bg-ink-2 p-5",
        mode === "create" ? "border border-clearance" : "border border-ink-3",
      ].join(" ")}
    >
      <div className="mb-4 flex items-baseline justify-between">
        <p className="caption text-clearance">
          — {mode === "create" ? "Add aircraft" : "Edit aircraft"}
        </p>
        {mode === "create" ? (
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
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr]">
          <div className="field-jn">
            <label htmlFor="ac-tail">Tail number</label>
            <input
              id="ac-tail"
              name="tailNumber"
              type="text"
              defaultValue={initial?.tailNumber ?? ""}
              placeholder="N123JN"
              required
              maxLength={16}
              minLength={3}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ac-operator">Operator</label>
            <select
              id="ac-operator"
              name="operatorId"
              defaultValue={initial?.operatorId ?? ""}
              required
            >
              <option value="" disabled>
                — Pick operator
              </option>
              {operatorOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="ac-makeModel">Make / model</label>
            <input
              id="ac-makeModel"
              name="makeModel"
              type="text"
              defaultValue={initial?.makeModel ?? ""}
              placeholder="Gulfstream G650ER"
              required
              maxLength={100}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ac-year">Year</label>
            <input
              id="ac-year"
              name="yearManufactured"
              type="number"
              min={1960}
              max={2100}
              defaultValue={initial?.yearManufactured ?? ""}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ac-category">Category</label>
            <select
              id="ac-category"
              name="category"
              defaultValue={initial?.category ?? "midsize"}
              required
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="ac-seats">Seats</label>
            <input
              id="ac-seats"
              name="seats"
              type="number"
              min={1}
              max={19}
              defaultValue={initial?.seats ?? 8}
              required
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ac-range">Range (NM)</label>
            <input
              id="ac-range"
              name="rangeNm"
              type="number"
              min={100}
              max={10000}
              defaultValue={initial?.rangeNm ?? 2500}
              required
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ac-speed">Cruise (KT)</label>
            <input
              id="ac-speed"
              name="speedKt"
              type="number"
              min={100}
              max={700}
              defaultValue={initial?.speedKt ?? 450}
              required
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ac-wifi">Wi-Fi</label>
            <select id="ac-wifi" name="wifiType" defaultValue={initial?.wifiType ?? "none"}>
              {WIFIS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="ac-base">Base (ICAO)</label>
            <input
              id="ac-base"
              name="baseIcao"
              type="text"
              defaultValue={initial?.baseIcao ?? ""}
              placeholder="KTEB"
              maxLength={4}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ac-cabin-height">Cabin height (in)</label>
            <input
              id="ac-cabin-height"
              name="cabinHeightIn"
              type="number"
              min={40}
              max={100}
              defaultValue={initial?.cabinHeightIn ?? ""}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ac-hours">Total hours</label>
            <input
              id="ac-hours"
              name="totalHours"
              type="number"
              min={0}
              defaultValue={initial?.totalHours ?? ""}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ac-ccheck">Last C-check</label>
            <input
              id="ac-ccheck"
              name="lastCCheckOn"
              type="date"
              defaultValue={initial?.lastCCheckOn ? String(initial.lastCCheckOn) : ""}
            />
          </div>
        </div>

        <div className="field-jn">
          <label htmlFor="ac-status">Status</label>
          <select id="ac-status" name="status" defaultValue={initial?.status ?? "available"}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {CABIN_FIELDS.map((f) => (
            <label
              key={String(f.name)}
              className="flex h-full cursor-pointer items-start gap-3 rounded-[2px] border border-ink-3 bg-ink p-4"
            >
              <input
                type="checkbox"
                name={String(f.name)}
                defaultChecked={initial ? ((initial[f.name] as boolean) ?? false) : false}
                className="mt-1 h-4 w-4 accent-clearance"
              />
              <div>
                <div className="font-serif text-[14px] text-bone">{f.label}</div>
                <div className="mt-1 text-[12px] leading-[1.5] text-bone-2">{f.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-3 pt-5">
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
              — Admin-only. Trip + soft-hold blocks reference this row by id, so changes are
              safe.
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending
              ? mode === "create"
                ? "Adding…"
                : "Saving…"
              : mode === "create"
                ? "Add aircraft"
                : "Save changes"}{" "}
            <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
