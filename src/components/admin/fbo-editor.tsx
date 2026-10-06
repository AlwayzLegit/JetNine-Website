"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createFbo, deleteFbo, toggleFboFlag } from "@/app/admin/airports/actions";
import type { Fbo } from "@/db/schema/airports";

const ROW_BTN = "btn btn-secondary h-9 px-3.5 text-[14px] disabled:cursor-wait disabled:opacity-50";

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
        setMsg({ tone: "ok", text: "Added — FBO on file." });
        form.reset();
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  function onDelete(fboId: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteFbo(airportId, fboId);
      if (result.ok) {
        setList((prev) => prev.filter((f) => f.id !== fboId));
        setMsg({ tone: "ok", text: "Removed." });
      } else {
        setMsg({ tone: "error", text: result.error });
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
                ? "Set as primary."
                : "No longer primary."
              : next
                ? "Marked preferred."
                : "No longer preferred.",
        });
      } else {
        setMsg({ tone: "error", text: result.error });
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
        <p className="rounded-control border border-dashed border-line-2 bg-surface-2 p-4 text-[14px] text-bone-2">
          No FBOs on file. Add at least one for busy airports so dispatch knows where to email arrival
          instructions.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((f) => (
            <li
              key={f.id}
              className={[
                "rounded-control border bg-surface-2 p-4",
                f.isPrimary ? "border-clearance" : f.isPreferred ? "border-line-2" : "border-line",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[16px] font-medium text-bone">{f.name}</span>
                <div className="flex flex-wrap gap-2">
                  {f.isPrimary ? <span className="pill pill-clearance">Primary</span> : null}
                  {f.isPreferred && !f.isPrimary ? <span className="pill pill-outline">Preferred</span> : null}
                  {f.customs24h ? (
                    <span className="pill pill-outline text-gold">Customs 24 h</span>
                  ) : null}
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-1 text-[14px] sm:grid-cols-2">
                {f.phoneE164 ? (
                  <a href={`tel:${f.phoneE164}`} className="text-link">
                    {f.phoneE164}
                  </a>
                ) : null}
                {f.afterHoursPhoneE164 ? (
                  <a href={`tel:${f.afterHoursPhoneE164}`} className="text-link">
                    After hours: {f.afterHoursPhoneE164}
                  </a>
                ) : null}
                {f.email ? (
                  <a href={`mailto:${f.email}`} className="text-link">
                    {f.email}
                  </a>
                ) : null}
                {f.radioFreqMhz ? <span className="text-bone-2">Radio {f.radioFreqMhz} MHz</span> : null}
                {f.website ? (
                  <a href={f.website} target="_blank" rel="noopener noreferrer" className="text-link">
                    {f.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : null}
                {f.hoursWeekday || f.hoursWeekend ? (
                  <span className="text-bone-2">
                    {f.hoursWeekday ?? "—"}
                    {f.hoursWeekend ? ` · weekends ${f.hoursWeekend}` : ""}
                  </span>
                ) : null}
              </dl>
              {f.notes ? <p className="mt-2 text-[14px] leading-[1.5] text-bone-2">{f.notes}</p> : null}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onToggle(f.id, "isPrimary", !f.isPrimary)}
                    disabled={pending}
                    className={ROW_BTN}
                  >
                    {f.isPrimary ? "Clear primary" : "Set primary"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggle(f.id, "isPreferred", !f.isPreferred)}
                    disabled={pending}
                    className={ROW_BTN}
                  >
                    {f.isPreferred ? "Un-prefer" : "Prefer"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(f.id)}
                  disabled={pending}
                  className={`${ROW_BTN} text-danger`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAdd} className="rounded-control border border-line bg-surface-2 p-4">
        <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-gold">Add FBO</h3>
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
            <label htmlFor="fbo-phone">Phone (with country code)</label>
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
            <label htmlFor="fbo-hours-wkd">Hours (weekdays)</label>
            <input
              id="fbo-hours-wkd"
              name="hoursWeekday"
              type="text"
              placeholder="0600–2200"
              maxLength={40}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="fbo-hours-wknd">Hours (weekends)</label>
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
          <label className="flex cursor-pointer items-center gap-3 py-1">
            <input type="checkbox" name="isPrimary" className="h-4 w-4 accent-clearance" />
            <span className="text-[14px] text-bone-2">Primary FBO</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 py-1">
            <input type="checkbox" name="isPreferred" className="h-4 w-4 accent-clearance" />
            <span className="text-[14px] text-bone-2">Preferred</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 py-1">
            <input type="checkbox" name="customs24h" className="h-4 w-4 accent-gold" />
            <span className="text-[14px] text-bone-2">Customs 24 h</span>
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
            <span className={`text-[14px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}>
              {msg.text}
            </span>
          ) : (
            <span className="text-[13px] text-steel">Setting a primary FBO demotes any other primary here.</span>
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
