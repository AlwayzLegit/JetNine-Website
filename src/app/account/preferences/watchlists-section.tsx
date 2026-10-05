"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteWatchlist, toggleWatchlistActive } from "./actions";
import type { EmptyLegWatchlist } from "@/db/schema/empty-legs";
import { PreferencesFeedback, errorSentence, type Feedback } from "@/components/account/preferences-feedback";

type Props = { initial: EmptyLegWatchlist[] };

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function day(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : DAY.format(d);
}

/**
 * "Empty-leg watchlists" card. Same pause / resume / remove actions as
 * before; new watchlists are still created from the public board.
 */
export function WatchlistsSection({ initial }: Props) {
  const [list, setList] = useState<EmptyLegWatchlist[]>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Feedback>(null);

  function onDelete(id: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteWatchlist(id);
      if (result.ok) {
        setList((prev) => prev.filter((w) => w.id !== id));
        setMsg({ tone: "ok", text: "Removed." });
      } else {
        setMsg({ tone: "error", text: errorSentence(result.error) });
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
          text: result.active ? "Resumed — alerts are on." : "Paused — alerts are off.",
        });
      } else {
        setMsg({ tone: "error", text: errorSentence(result.error) });
      }
    });
  }

  // Active first, alpha by from-text.
  const sorted = [...list].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (a.fromText ?? "").localeCompare(b.fromText ?? "");
  });

  return (
    <section className="border border-line bg-surface px-5 py-[18px] md:px-6 md:py-5">
      <h2 className="font-serif text-[20px] font-normal leading-[1.2] text-bone">Empty-leg watchlists</h2>
      <p className="mt-1 max-w-[60ch] text-[14px] leading-[1.5] text-steel">
        Routes and date windows you want to hear about when a repositioning flight lists. Pause to
        mute, remove to drop.
      </p>

      {sorted.length === 0 ? (
        <p className="mt-6 text-[15px] leading-[1.55] text-bone-2">
          No watchlists yet. Set one up from the{" "}
          <Link href="/empty-legs" className="text-link">
            empty legs board
          </Link>{" "}
          and we&rsquo;ll text you when a matching flight lists.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {sorted.map((w) => {
            const from = day(w.earliestOn);
            const to = day(w.latestOn);
            const facts: string[] = [from && to ? `${from} to ${to}` : "Any date", `at least ${w.minDiscountPct}% off`];
            const channels: string[] = [];
            if (w.notifyChannels?.sms) channels.push("text");
            if (w.notifyChannels?.email) channels.push("email");
            if (channels.length) facts.push(`by ${channels.join(" and ")}`);
            return (
              <li
                key={w.id}
                className={[
                  "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4",
                  w.active ? "" : "opacity-60",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="font-serif text-[18px] text-bone">
                    {w.fromText ?? w.fromIcao ?? "Anywhere"} → {w.toText ?? w.toIcao ?? "Anywhere"}
                  </div>
                  <div className="mt-0.5 text-[14px] text-bone-2">
                    {w.active ? "" : "Paused · "}
                    {facts.join(" · ")}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onToggle(w.id, !w.active)}
                    disabled={pending}
                    className="btn btn-secondary btn-sm disabled:cursor-wait"
                  >
                    {w.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(w.id)}
                    disabled={pending}
                    className="text-link min-h-[44px] text-[15px] disabled:cursor-wait disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
        <Link href="/empty-legs" className="btn btn-primary btn-sm">
          Add from the board <span aria-hidden="true">→</span>
        </Link>
        {msg ? (
          <PreferencesFeedback msg={msg} />
        ) : (
          <p className="text-[14px] text-steel">
            New watchlists start from the public board, where the route and dates live.
          </p>
        )}
      </div>
    </section>
  );
}
