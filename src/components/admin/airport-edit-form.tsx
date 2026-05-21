"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteAirport, updateAirport } from "@/app/admin/airports/actions";
import type { Airport } from "@/db/schema/airports";

const CUSTOMS_OPTIONS = [
  { id: "none", label: "None — no customs" },
  { id: "user_fee", label: "User fee — onboarded customs by appointment" },
  { id: "aoe", label: "AOE — Airport of Entry" },
  { id: "intl", label: "Intl — full international gateway" },
] as const;

export function AirportEditForm({ initial }: { initial: Airport }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const result = await updateAirport(initial.id, data);
      if (result.ok) {
        setMsg({ tone: "ok", text: "SAVED." });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onDelete() {
    if (
      !confirm(
        `Permanently delete ${initial.icao}? Cascades to its FBOs. ICAO references elsewhere stay as free text but lose their catalog link.`,
      )
    ) {
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const result = await deleteAirport(initial.id);
      if (result.ok) {
        router.push("/admin/airports");
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <div className="field-jn">
          <label htmlFor="ae-icao">ICAO</label>
          <input
            id="ae-icao"
            name="icao"
            type="text"
            defaultValue={initial.icao}
            required
            maxLength={4}
            minLength={4}
            style={{ textTransform: "uppercase" }}
          />
        </div>
        <div className="field-jn">
          <label htmlFor="ae-iata">IATA</label>
          <input
            id="ae-iata"
            name="iata"
            type="text"
            defaultValue={initial.iata ?? ""}
            maxLength={3}
            style={{ textTransform: "uppercase" }}
          />
        </div>
        <div className="field-jn">
          <label htmlFor="ae-country">Country (ISO-2)</label>
          <input
            id="ae-country"
            name="countryIso2"
            type="text"
            defaultValue={initial.countryIso2}
            required
            maxLength={2}
            minLength={2}
            style={{ textTransform: "uppercase" }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <div className="field-jn">
          <label htmlFor="ae-name">Name</label>
          <input
            id="ae-name"
            name="name"
            type="text"
            defaultValue={initial.name}
            required
            maxLength={120}
          />
        </div>
        <div className="field-jn">
          <label htmlFor="ae-city">City</label>
          <input
            id="ae-city"
            name="city"
            type="text"
            defaultValue={initial.city}
            required
            maxLength={80}
          />
        </div>
        <div className="field-jn">
          <label htmlFor="ae-region">Region (state/canton)</label>
          <input
            id="ae-region"
            name="region"
            type="text"
            defaultValue={initial.region ?? ""}
            maxLength={40}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_1fr]">
        <div className="field-jn">
          <label htmlFor="ae-lat">Latitude</label>
          <input
            id="ae-lat"
            name="lat"
            type="number"
            step="0.00001"
            defaultValue={String(initial.lat)}
            required
          />
        </div>
        <div className="field-jn">
          <label htmlFor="ae-lon">Longitude</label>
          <input
            id="ae-lon"
            name="lon"
            type="number"
            step="0.00001"
            defaultValue={String(initial.lon)}
            required
          />
        </div>
        <div className="field-jn">
          <label htmlFor="ae-elevation">Elevation (ft)</label>
          <input
            id="ae-elevation"
            name="elevationFt"
            type="number"
            defaultValue={initial.elevationFt ?? ""}
          />
        </div>
        <div className="field-jn">
          <label htmlFor="ae-runway">Longest runway (ft)</label>
          <input
            id="ae-runway"
            name="longestRunwayFt"
            type="number"
            defaultValue={initial.longestRunwayFt ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr]">
        <div className="field-jn">
          <label htmlFor="ae-tz">Timezone (IANA)</label>
          <input
            id="ae-tz"
            name="tz"
            type="text"
            defaultValue={initial.tz ?? ""}
            placeholder="America/Los_Angeles"
            maxLength={64}
          />
        </div>
        <div className="field-jn">
          <label htmlFor="ae-category">Category</label>
          <input
            id="ae-category"
            name="category"
            type="text"
            defaultValue={initial.category ?? ""}
            placeholder="private / regional / intl"
            maxLength={40}
          />
        </div>
      </div>

      <div className="field-jn">
        <label htmlFor="ae-customs">Customs</label>
        <select id="ae-customs" name="customs" defaultValue={initial.customs}>
          {CUSTOMS_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-[2px] border border-ink-3 bg-ink p-4">
          <input
            type="checkbox"
            name="slotControlled"
            defaultChecked={initial.slotControlled}
            className="mt-1 h-4 w-4 accent-clearance"
          />
          <div>
            <div className="font-serif text-[14px] text-bone">Slot-controlled</div>
            <div className="mt-1 text-[12px] leading-[1.5] text-bone-2">
              Departure/arrival slot required (LHR, JFK at peak).
            </div>
          </div>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-[2px] border border-ink-3 bg-ink p-4">
          <input
            type="checkbox"
            name="privateOnly"
            defaultChecked={initial.privateOnly}
            className="mt-1 h-4 w-4 accent-clearance"
          />
          <div>
            <div className="font-serif text-[14px] text-bone">Private only</div>
            <div className="mt-1 text-[12px] leading-[1.5] text-bone-2">
              No scheduled commercial operations permitted.
            </div>
          </div>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-[2px] border border-ink-3 bg-ink p-4">
          <input
            type="checkbox"
            name="inactive"
            defaultChecked={!initial.active}
            className="mt-1 h-4 w-4 accent-[var(--error)]"
          />
          <div>
            <div className="font-serif text-[14px] text-bone">Inactive</div>
            <div className="mt-1 text-[12px] leading-[1.5] text-bone-2">
              Hide from selectors. Soft-delete alternative to hard remove.
            </div>
          </div>
        </label>
      </div>

      <div className="field-jn">
        <label htmlFor="ae-notes">Notes</label>
        <textarea
          id="ae-notes"
          name="notes"
          defaultValue={initial.notes ?? ""}
          rows={3}
          placeholder="Ops notes: noise abatement, prior-permission required, runway closures, etc."
          maxLength={800}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-3 pt-5">
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-[var(--error)] disabled:cursor-wait disabled:opacity-50"
        >
          Delete airport →
        </button>
        <div className="flex items-center gap-5">
          {msg ? (
            <span
              className={[
                "font-mono text-[11px] uppercase tracking-[0.12em]",
                msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
              ].join(" ")}
            >
              {msg.text}
            </span>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"} <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </form>
  );
}
