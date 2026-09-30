"use client";

import { useEffect, useState } from "react";

/**
 * Local time at the Van Nuys desk for the contact-page status pill:
 * "3:42 PM in Los Angeles", refreshed every 30 seconds per the handoff.
 *
 * Renders a dash placeholder until mounted so SSR and the first client
 * paint agree; the real time appears right after hydration.
 */
export function DeskClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const local = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        minute: "2-digit",
      }).format(now)
    : "–:––";

  return (
    <span data-testid="desk-clock">
      {now ? <time dateTime={now.toISOString()}>{local}</time> : local} in Los Angeles
    </span>
  );
}
