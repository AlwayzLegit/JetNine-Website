"use client";

import { useEffect, useState } from "react";
import { useQuoteStore, isoDateAheadDays } from "@/lib/quote-store";

/**
 * Renders children only after the Zustand store has rehydrated from
 * sessionStorage. SSR + first client render produce identical output
 * (skeleton); the form swaps in after hydration without React tripping
 * on attribute mismatches.
 *
 * Also seeds default depart/return dates if the store didn't have them
 * (e.g. brand-new session, no persisted draft).
 */
export function StoreHydrationGate({
  children,
  skeleton,
}: {
  children: React.ReactNode;
  skeleton?: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await useQuoteStore.persist.rehydrate();
      if (!mounted) return;
      const s = useQuoteStore.getState();
      s.legs.forEach((l, i) => {
        if (!l.date) s.updateLeg(l.id, { date: isoDateAheadDays(14 + i * 4) });
      });
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      // One panel-shaped placeholder, matching the step's QuotePanel in
      // the layout's 760px column.
      skeleton ?? (
        <div className="min-w-0 rounded-card border border-line bg-surface px-[clamp(16px,4vw,32px)] pb-6 pt-7">
          <div className="h-3 w-32 rounded-control bg-surface-2" aria-hidden />
          <div className="mt-3 h-10 w-3/4 max-w-[28ch] rounded-control bg-surface-2" aria-hidden />
          <div className="mt-6 h-[420px] rounded-control bg-ink" aria-hidden />
          <p className="sr-only">Loading your quote draft…</p>
        </div>
      )
    );
  }

  return <>{children}</>;
}
