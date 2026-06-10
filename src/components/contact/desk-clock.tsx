"use client";

import { useEffect, useState } from "react";

/**
 * Live clock for the contact-page status strip — local time at the Van
 * Nuys desk plus Zulu, ticking every second. This replaces the old
 * hardcoded "LOS ANGELES · 24/7" copy with something verifiably real
 * while staying clear of fabricated staffing data (no invented names,
 * no fake on-duty roster — see the page TODO this resolved).
 *
 * Renders an em-dash placeholder until mounted so SSR and the first
 * client paint agree; the real time appears one tick after hydration.
 */
export function DeskClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const local = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now)
    : "--:--:--";

  const zulu = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now)
    : "--:--";

  return (
    <span className="ml-auto text-steel" data-testid="desk-clock">
      VAN NUYS {local} · {zulu}Z · 24/7
    </span>
  );
}
