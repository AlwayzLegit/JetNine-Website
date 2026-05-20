"use client";

import { useState, type FormEvent } from "react";

type Tab = "round" | "one" | "multi";

type FieldErrors = Partial<Record<"from" | "to" | "depart" | "return" | "pax", true>>;

const TABS: { id: Tab; label: string }[] = [
  { id: "round", label: "Round trip" },
  { id: "one", label: "One way" },
  { id: "multi", label: "Multi-leg" },
];

export function BookingWidget() {
  const [tab, setTab] = useState<Tab>("round");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(
    null,
  );

  function changeTab(next: Tab) {
    setTab(next);
    setErrors({});
    setMsg(
      next === "multi"
        ? { tone: "info", text: "MULTI-LEG — ADD UP TO 5 SECTORS AFTER SEARCH" }
        : null,
    );
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const required: (keyof FieldErrors)[] = ["from", "to", "depart", "pax"];
    if (tab === "round") required.push("return");

    const missing: FieldErrors = {};
    for (const key of required) {
      const v = (data.get(key) as string | null)?.trim();
      if (!v) missing[key] = true;
    }

    if (Object.keys(missing).length) {
      setErrors(missing);
      setMsg({
        tone: "error",
        text: `MISSING — ${Object.keys(missing).join(", ").toUpperCase()}`,
      });
      return;
    }

    setErrors({});
    setMsg({
      tone: "success",
      text: `CLEARED — ${(data.get("from") as string).toUpperCase()} → ${(data.get("to") as string).toUpperCase()} · ${data.get("depart")} · ${data.get("pax")} PAX`,
    });
  }

  return (
    <div className="relative z-[5] -mt-20 px-[var(--pad-x)]">
      <div className="mx-auto max-w-container rounded-[4px] border border-ink-3 bg-ink-2 p-8">
        <div className="mb-8 flex gap-8 border-b border-ink-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => changeTab(t.id)}
              className={[
                "relative cursor-pointer border-none bg-transparent py-4 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                tab === t.id ? "text-bone after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-clearance" : "text-bone-2 hover:text-bone",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form
          noValidate
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:[grid-template-columns:1.2fr_1.2fr_1fr_1fr_0.7fr_auto]"
        >
          <div className={`field-jn ${errors.from ? "error" : ""}`}>
            <label htmlFor="bw-from">From</label>
            <input id="bw-from" name="from" type="text" placeholder="Origin · KLAX" autoComplete="off" />
          </div>
          <div className={`field-jn ${errors.to ? "error" : ""}`}>
            <label htmlFor="bw-to">To</label>
            <input id="bw-to" name="to" type="text" placeholder="Destination · KASE" autoComplete="off" />
          </div>
          <div className={`field-jn ${errors.depart ? "error" : ""}`}>
            <label htmlFor="bw-depart">Depart</label>
            <input id="bw-depart" name="depart" type="date" />
          </div>
          {tab === "round" ? (
            <div className={`field-jn ${errors.return ? "error" : ""}`}>
              <label htmlFor="bw-return">Return</label>
              <input id="bw-return" name="return" type="date" />
            </div>
          ) : (
            <div aria-hidden className="hidden sm:block" />
          )}
          <div className={`field-jn ${errors.pax ? "error" : ""}`}>
            <label htmlFor="bw-pax">Pax</label>
            <input id="bw-pax" name="pax" type="number" min={1} max={19} placeholder="2" />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2.5 rounded-[2px] border-none bg-clearance px-7 font-sans text-[12px] font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-clearance-hover"
          >
            Search <span className="arrow">→</span>
          </button>
        </form>

        <div className="mt-5 flex justify-end">
          {msg ? (
            <p
              className={[
                "font-mono text-[11px] uppercase tracking-[0.12em]",
                msg.tone === "error"
                  ? "text-[var(--error)]"
                  : msg.tone === "success"
                    ? "text-[var(--success)]"
                    : "text-bone-2",
              ].join(" ")}
            >
              {msg.text}
            </p>
          ) : (
            <a
              href="/contact"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-bone-2 transition-colors hover:text-bone"
            >
              Need help choosing? Talk to a flight advisor →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
