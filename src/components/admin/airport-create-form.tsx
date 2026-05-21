"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createAirport } from "@/app/admin/airports/actions";

export function AirportCreateForm() {
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
      const result = await createAirport(data);
      if (result.ok) {
        setMsg({ tone: "ok", text: `ADDED — ${result.icao}` });
        form.reset();
        // Navigate into the new detail page so they can add FBOs.
        router.push(`/admin/airports/${result.id}`);
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
        + Add airport <span className="arrow">→</span>
      </button>
    );
  }

  return (
    <div className="rounded-[4px] border border-clearance bg-ink-2 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="caption text-clearance">— Add airport</p>
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="ap-icao">ICAO (4)</label>
            <input
              id="ap-icao"
              name="icao"
              type="text"
              placeholder="KVNY"
              required
              maxLength={4}
              minLength={4}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ap-iata">IATA (3, optional)</label>
            <input
              id="ap-iata"
              name="iata"
              type="text"
              placeholder="VNY"
              maxLength={3}
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ap-country">Country (ISO-2)</label>
            <input
              id="ap-country"
              name="countryIso2"
              type="text"
              placeholder="US"
              required
              maxLength={2}
              minLength={2}
              style={{ textTransform: "uppercase" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
          <div className="field-jn">
            <label htmlFor="ap-name">Name</label>
            <input
              id="ap-name"
              name="name"
              type="text"
              placeholder="Van Nuys"
              required
              maxLength={120}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ap-city">City</label>
            <input
              id="ap-city"
              name="city"
              type="text"
              placeholder="Los Angeles"
              required
              maxLength={80}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr]">
          <div className="field-jn">
            <label htmlFor="ap-lat">Latitude</label>
            <input id="ap-lat" name="lat" type="number" step="0.00001" placeholder="34.21000" required />
          </div>
          <div className="field-jn">
            <label htmlFor="ap-lon">Longitude</label>
            <input
              id="ap-lon"
              name="lon"
              type="number"
              step="0.00001"
              placeholder="-118.49000"
              required
            />
          </div>
          <div className="field-jn">
            <label htmlFor="ap-tz">Timezone (IANA)</label>
            <input
              id="ap-tz"
              name="tz"
              type="text"
              placeholder="America/Los_Angeles"
              maxLength={64}
            />
          </div>
        </div>

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
              — Open the airport after creating to fill in customs, runway, FBOs.
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add airport"} <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
