"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createWatchlist } from "@/app/(marketing)/empty-legs/actions";

type FieldName = "from" | "to" | "earliest" | "latest" | "mobile" | "email";
type Errors = Partial<Record<FieldName, true>>;

export function WatchlistForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Cheap client-side check so we don't round-trip to the server for
    // obvious missing fields. The Server Action repeats the validation.
    const data = new FormData(e.currentTarget);
    const next: Errors = {};
    const required: FieldName[] = ["from", "to", "earliest", "latest", "mobile"];
    for (const k of required) {
      if (!(data.get(k) as string | null)?.trim()) next[k] = true;
    }
    const mobile = (data.get("mobile") as string)?.trim() ?? "";
    if (mobile && !/^\+?[\d\s().-]{7,}$/.test(mobile)) next.mobile = true;
    const email = (data.get("email") as string)?.trim() ?? "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = true;

    if (Object.keys(next).length) {
      setErrors(next);
      setMsg({
        tone: "error",
        text: `MISSING / INVALID — ${Object.keys(next).join(", ").toUpperCase()}`,
      });
      return;
    }

    setErrors({});
    const form = e.currentTarget;
    startTransition(async () => {
      const result = await createWatchlist(data);
      if (result.ok) {
        setMsg({ tone: "ok", text: `CLEARED — ${result.message}` });
        form.reset();
      } else {
        setMsg({ tone: "error", text: `MISSING / INVALID — ${result.error}` });
      }
    });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className={`field-jn ${errors.from ? "error" : ""}`}>
        <label htmlFor="wl-from">Departing</label>
        <input id="wl-from" name="from" type="text" placeholder="KVNY or Los Angeles" />
      </div>
      <div className={`field-jn ${errors.to ? "error" : ""}`}>
        <label htmlFor="wl-to">Arriving</label>
        <input id="wl-to" name="to" type="text" placeholder="KTEB or New York" />
      </div>
      <div className={`field-jn ${errors.earliest ? "error" : ""}`}>
        <label htmlFor="wl-earliest">Earliest date</label>
        <input id="wl-earliest" name="earliest" type="date" />
      </div>
      <div className={`field-jn ${errors.latest ? "error" : ""}`}>
        <label htmlFor="wl-latest">Latest date</label>
        <input id="wl-latest" name="latest" type="date" />
      </div>
      <div className={`field-jn ${errors.mobile ? "error" : ""}`}>
        <label htmlFor="wl-mobile">Mobile (for SMS)</label>
        <input id="wl-mobile" name="mobile" type="tel" placeholder="+1 555 555 5555" />
      </div>
      <div className={`field-jn ${errors.email ? "error" : ""}`}>
        <label htmlFor="wl-email">Email (optional)</label>
        <input id="wl-email" name="email" type="email" placeholder="you@example.com" />
      </div>

      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-4 pt-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
          — No fees · cancel any time · 1 SMS per match
        </p>
        <div className="flex items-center gap-6">
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
            className="btn btn-primary disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Saving…" : "Create watchlist"} <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </form>
  );
}
