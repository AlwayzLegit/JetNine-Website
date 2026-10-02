/**
 * Plain-words formatters shared by the guest status page, the member
 * account and the dispatch desk. Pure: no database, no React — safe to
 * import from client components. `request-page.ts` re-exports everything
 * here so existing server imports keep working.
 */

// ─── Plain-words formatting ───────────────────────────────────────────────

const DAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const LONG_DAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/** "Fri, Oct 3" from a YYYY-MM-DD date (no timezone shift). */
export function formatDay(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : DAY_FMT.format(d);
}

export function formatLongDay(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : LONG_DAY_FMT.format(d);
}

/** "in the morning" from HH:MM. */
export function timeOfDay(time: string | null | undefined): string | null {
  if (!time) return null;
  const h = Number(time.slice(0, 2));
  if (Number.isNaN(h)) return null;
  if (h < 5) return "overnight";
  if (h < 11) return "in the morning";
  if (h < 14) return "around midday";
  if (h < 17) return "in the afternoon";
  if (h < 21) return "in the evening";
  return "late in the evening";
}

/** "9:00 AM" from HH:MM. */
export function formatClock(time: string | null | undefined): string | null {
  if (!time) return null;
  const [hh, mm] = time.split(":");
  const h = Number(hh);
  if (Number.isNaN(h)) return null;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${(mm ?? "00").slice(0, 2)} ${suffix}`;
}

/** "about 2 h 10 min" from minutes. */
export function formatMinutes(min: number | null | undefined): string | null {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `about ${m} min`;
  return m === 0 ? `about ${h} h` : `about ${h} h ${m} min`;
}

export const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const CATEGORY_PLAIN: Record<string, string> = {
  turboprop: "Turboprop",
  light: "Light jet",
  midsize: "Midsize jet",
  supermid: "Super-midsize jet",
  heavy: "Heavy jet",
  ulr: "Ultra long range jet",
  ultra: "Ultra long range jet",
};

export const CATEGORY_IMAGE: Record<string, string> = {
  turboprop: "/images/fleet/turboprop.webp",
  light: "/images/fleet/light.webp",
  midsize: "/images/fleet/midsize.webp",
  supermid: "/images/fleet/supermid.webp",
  heavy: "/images/fleet/heavy.webp",
  ulr: "/images/fleet/ultra.webp",
  ultra: "/images/fleet/ultra.webp",
};

export function tripTypeWords(t: "one_way" | "round" | "multi_leg" | (string & {})): string {
  return t === "round" ? "round trip" : t === "one_way" ? "one way" : "multi-leg";
}

export function relativeTime(from: Date, now = new Date()): string {
  const diff = Math.max(0, now.getTime() - from.getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}
