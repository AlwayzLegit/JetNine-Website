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
      // Two grid children, matching the step's form column + sidebar in
      // the quote layout's `minmax(0,1fr) 340px` grid.
      skeleton ?? (
        <>
          <div className="min-w-0">
            <div className="h-12 w-3/4 max-w-[40ch] rounded-control bg-surface-2" aria-hidden />
            <div className="mt-6 h-[480px] rounded-card bg-surface" aria-hidden />
            <p className="sr-only">Loading your quote draft…</p>
          </div>
          <div className="h-[480px] rounded-card bg-surface max-lg:hidden" aria-hidden />
        </>
      )
    );
  }

  return <>{children}</>;
}
