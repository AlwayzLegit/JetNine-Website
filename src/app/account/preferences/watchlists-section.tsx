"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteWatchlist, toggleWatchlistActive } from "./actions";
import type { EmptyLegWatchlist } from "@/db/schema/empty-legs";

type Props = { initial: EmptyLegWatchlist[] };

export function WatchlistsSection({ initial }: Props) {
  const [list, setList] = useState<EmptyLegWatchlist[]>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onDelete(id: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteWatchlist(id);
      if (result.ok) {
        setList((prev) => prev.filter((w) => w.id !== id));
        setMsg({ tone: "ok", text: "REMOVED." });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onToggle(id: string, next: boolean) {
    setMsg(null);
    startTransition(async () => {
      const result = await toggleWatchlistActive(id, next);
      if (result.ok) {
        setList((prev) =>
          prev.map((w) => (w.id === id ? { ...w, active: result.active } : w)),
        );
        setMsg({
          tone: "ok",
          text: result.active ? "RESUMED — alerts on." : "PAUSED — alerts off.",
        });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  // Active first, alpha by from-text.
  const sorted = [...list].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (a.fromText ?? "").localeCompare(b.fromText ?? "");
  });

  return (
    <div className="flex flex-col gap-4">
      {sorted.length === 0 ? (
        <p className="rounded-[2px] border border-dashed border-ink-3 bg-ink-2 p-6 font-mono text-[11px] uppercase tracking-[0.1em] text-bone-2">
          — No watchlists yet. Set one up from{" "}
          <Link href="/empty-legs" className="text-clearance hover:underline">
            /empty-legs
          </Link>{" "}
          and we&rsquo;ll text when a matching repositioning leg lists.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((w) => (
            <li
              key={w.id}
              className={[
                "rounded-[2px] border bg-ink-2 px-5 py-4",
                w.active ? "border-ink-3" : "border-ink-3 opacity-60",
              ].join(" ")}
            >
              <div className="grid grid-cols-[1fr_auto] items-start gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-serif text-[17px] text-bone">
                      {w.fromText ?? w.fromIcao ?? "—"}{" "}
                      <span className="text-clearance">→</span>{" "}
                      {w.toText ?? w.toIcao ?? "—"}
                    </span>
                    {!w.active ? (
                      <span className="rounded-[2px] border border-bone-2 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-bone-2">
                        Paused
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-2">
                    {w.earliestOn && w.latestOn ? (
                      <>
                        {w.earliestOn} → {w.latestOn}
                      </>
                    ) : (
                      "any date"
                    )}
                    {" · "}
                    ≥ {w.minDiscountPct}% off
                    {w.notifyChannels?.sms ? " · sms" : ""}
                    {w.notifyChannels?.email ? " · email" : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => onToggle(w.id, !w.active)}
                    disabled={pending}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance disabled:cursor-wait disabled:opacity-50"
                  >
                    {w.active ? "Pause →" : "Resume →"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(w.id)}
                    disabled={pending}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-[var(--error)] disabled:cursor-wait disabled:opacity-50"
                  >
                    Remove →
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

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
            — New watchlists are created from the public board so the route + dates form
            stays in one place.
          </span>
        )}
        <Link href="/empty-legs" className="btn btn-secondary btn-sm">
          + Add from board <span className="arrow">→</span>
        </Link>
      </div>
    </div>
  );
}
