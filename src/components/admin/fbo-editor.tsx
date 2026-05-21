"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createFbo, deleteFbo, toggleFboFlag } from "@/app/admin/airports/actions";
import type { Fbo } from "@/db/schema/airports";

export function FboEditor({
  airportId,
  initial,
}: {
  airportId: string;
  initial: Fbo[];
}) {
  const [list, setList] = useState<Fbo[]>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);

    startTransition(async () => {
      const result = await createFbo(airportId, data);
      if (result.ok) {
        const optimistic: Fbo = {
          id: result.id,
          airportId,
          name: ((data.get("name") as string) ?? "").trim(),
          isPrimary: data.get("isPrimary") === "on",
          isPreferred: data.get("isPreferred") === "on",
          radioFreqMhz: ((data.get("radioFreqMhz") as string) ?? "").trim() || null,
          phoneE164: ((data.get("phoneE164") as string) ?? "").trim() || null,
          afterHoursPhoneE164: ((data.get("afterHoursPhoneE164") as string) ?? "").trim() || null,
          email: ((data.get("email") as string) ?? "").trim() || null,
          website: ((data.get("website") as string) ?? "").trim() || null,
          hoursWeekday: ((data.get("hoursWeekday") as string) ?? "").trim() || null,
          hoursWeekend: ((data.get("hoursWeekend") as string) ?? "").trim() || null,
          customs24h: data.get("customs24h") === "on",
          notes: ((data.get("notes") as string) ?? "").trim() || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setList((prev) => [...prev, optimistic]);
        setMsg({ tone: "ok", text: "ADDED — FBO on file." });
        form.reset();
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onDelete(fboId: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteFbo(airportId, fboId);
      if (result.ok) {
        setList((prev) => prev.filter((f) => f.id !== fboId));
        setMsg({ tone: "ok", text: "REMOVED." });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onToggle(fboId: string, field: "isPrimary" | "isPreferred", next: boolean) {
    setMsg(null);
    startTransition(async () => {
      const result = await toggleFboFlag(airportId, fboId, field, next);
      if (result.ok) {
        setList((prev) =>
          prev.map((f) => {
            if (f.id === fboId) return { ...f, [field]: result.value };
            // Server demotes other primaries — mirror that locally.
            if (field === "isPrimary" && next && f.isPrimary) {
              return { ...f, isPrimary: false };
            }
            return f;
          }),
        );
        setMsg({
          tone: "ok",
          text:
            field === "isPrimary"
              ? next
                ? "PRIMARY SET."
                : "PRIMARY CLEARED."
              : next
                ? "PREFERRED."
                : "UN-PREFERRED.",
        });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  // Primary first, then preferred, then alpha.
  const sorted = [...list].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-5">
      {sorted.length === 0 ? (
        <p className="rounded-[2px] border border-dashed border-ink-3 bg-ink p-4 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-2">
          — No FBOs on file. Add at least one for class-B+ airports so dispatch knows where to
          email arrival instructions.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((f) => (
            <li
              key={f.id}
              className={[
                "rounded-[3px] border bg-ink p-4",
                f.isPrimary
                  ? "border-clearance"
                  : f.isPreferred
                    ? "border-bone-2"
                    : "border-ink-3",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-serif text-[16px] text-bone">{f.name}</span>
                <div className="flex gap-2">
                  {f.isPrimary ? (
                    <span className="rounded-[2px] bg-clearance px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-ink">
                      Primary
                    </span>
                  ) : null}
                  {f.isPreferred && !f.isPrimary ? (
                    <span className="rounded-[2px] border border-clearance px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-clearance">
                      Preferred
                    </span>
                  ) : null}
                  {f.customs24h ? (
                    <span className="rounded-[2px] border border-[var(--warn)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--warn)]">
                      Customs 24h
                    </span>
                  ) : null}
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
                {f.phoneE164 ? (
                  <a
                    href={`tel:${f.phoneE164}`}
                    className="font-mono tracking-[0.04em] text-clearance hover:underline"
                  >
                    {f.phoneE164}
                  </a>
                ) : null}
                {f.afterHoursPhoneE164 ? (
                  <a
                    href={`tel:${f.afterHoursPhoneE164}`}
                    className="font-mono tracking-[0.04em] text-bone-2 hover:text-clearance hover:underline"
                  >
                    after-hours: {f.afterHoursPhoneE164}
                  </a>
                ) : null}
                {f.email ? (
                  <a
                    href={`mailto:${f.email}`}
                    className="font-mono tracking-[0.04em] text-clearance hover:underline"
                  >
                    {f.email}
                  </a>
                ) : null}
                {f.radioFreqMhz ? (
                  <span className="font-mono tracking-[0.04em] text-bone-2">
                    Radio {f.radioFreqMhz} MHz
                  </span>
                ) : null}
                {f.website ? (
                  <a
                    href={f.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono tracking-[0.04em] text-bone-2 hover:text-clearance hover:underline"
                  >
                    {f.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : null}
                {f.hoursWeekday || f.hoursWeekend ? (
                  <span className="font-mono tracking-[0.04em] text-bone-2">
                    {f.hoursWeekday ?? "—"}{" "}
                    {f.hoursWeekend ? `· wknd ${f.hoursWeekend}` : ""}
                  </span>
                ) : null}
              </dl>
              {f.notes ? (
                <p className="mt-2 text-[12px] leading-[1.5] text-bone-2">{f.notes}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-3 pt-3">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => onToggle(f.id, "isPrimary", !f.isPrimary)}
                    disabled={pending}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance disabled:cursor-wait disabled:opacity-50"
                  >
                    {f.isPrimary ? "Clear primary" : "Set primary"} →
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggle(f.id, "isPreferred", !f.isPreferred)}
                    disabled={pending}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance disabled:cursor-wait disabled:opacity-50"
                  >
                    {f.isPreferred ? "Un-prefer" : "Prefer"} →
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(f.id)}
                  disabled={pending}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-[var(--error)] disabled:cursor-wait disabled:opacity-50"
                >
                  Remove →
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAdd} className="rounded-[3px] border border-ink-3 bg-ink p-4">
        <p className="caption mb-3">— Add FBO</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="field-jn">
            <label htmlFor="fbo-name">Name</label>
            <input
              id="fbo-name"
              name="name"
              type="text"
              placeholder="Signature Flight Support"
              required
              maxLength={120}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="fbo-radio">Radio (MHz)</label>
            <input
              id="fbo-radio"
              name="radioFreqMhz"
              type="number"
              step="0.001"
              placeholder="129.150"
            />
          </div>
          <div className="field-jn">
            <label htmlFor="fbo-phone">Phone (E.164)</label>
            <input id="fbo-phone" name="phoneE164" type="tel" placeholder="+18185551234" />
          </div>
          <div className="field-jn">
            <label htmlFor="fbo-afterhours">After-hours phone</label>
            <input
              id="fbo-afterhours"
              name="afterHoursPhoneE164"
              type="tel"
              placeholder="+18185559999"
            />
          </div>
          <div className="field-jn">
            <label htmlFor="fbo-email">Email</label>
            <input id="fbo-email" name="email" type="email" placeholder="ops@example.com" />
          </div>
          <div className="field-jn">
            <label htmlFor="fbo-website">Website</label>
            <input id="fbo-website" name="website" type="url" placeholder="https://example.com" />
          </div>
          <div className="field-jn">
            <label htmlFor="fbo-hours-wkd">Hours (weekday)</label>
            <input
              id="fbo-hours-wkd"
              name="hoursWeekday"
              type="text"
              placeholder="0600–2200"
              maxLength={40}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="fbo-hours-wknd">Hours (weekend)</label>
            <input
              id="fbo-hours-wknd"
              name="hoursWeekend"
              type="text"
              placeholder="0700–2100"
              maxLength={40}
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" name="isPrimary" className="h-4 w-4 accent-clearance" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
              Primary FBO
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" name="isPreferred" className="h-4 w-4 accent-clearance" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
              Preferred
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" name="customs24h" className="h-4 w-4 accent-[var(--warn)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
              Customs 24h
            </span>
          </label>
        </div>
        <div className="field-jn mt-3">
          <label htmlFor="fbo-notes">Notes</label>
          <textarea
            id="fbo-notes"
            name="notes"
            rows={2}
            placeholder="Gate code, security quirks, crew rest details."
            maxLength={400}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
              — Setting Primary demotes any other primary on this airport.
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add FBO"} <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
