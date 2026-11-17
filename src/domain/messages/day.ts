// The Los Angeles calendar day around an instant, as two instants (OPS-127).
// Postgres compared (occurred_at at time zone 'America/Los_Angeles')::date to
// today's date; SQLite has no time zones, so the app computes the day's start
// (included) and end (excluded) and both databases compare plain instants.
// Daylight saving changes make a day 23 or 25 hours long: the start of the next
// day is computed from the next calendar date, not by adding 24 hours.

const ZONE = "America/Los_Angeles";

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

function wallClock(t: number): { y: number; m: number; d: number; asUtc: number } {
  const get: Record<string, number> = {};
  for (const p of parts.formatToParts(new Date(t))) {
    if (p.type !== "literal") get[p.type] = Number(p.value);
  }
  return {
    y: get.year,
    m: get.month,
    d: get.day,
    asUtc: Date.UTC(get.year, get.month - 1, get.day, get.hour, get.minute, get.second),
  };
}

/** The instant at which the Los Angeles wall clock reads y-m-d 00:00:00. */
function laMidnight(y: number, m: number, d: number): number {
  const guess = Date.UTC(y, m - 1, d);
  // Offset of the zone at the guessed instant, then again at the corrected one
  // (the offset can differ across a daylight saving change).
  let start = guess - (wallClock(guess).asUtc - guess);
  start = guess - (wallClock(start).asUtc - start);
  return start;
}

export function laDayBounds(now: Date = new Date()): { start: Date; end: Date } {
  const { y, m, d } = wallClock(now.getTime());
  return { start: new Date(laMidnight(y, m, d)), end: new Date(laMidnight(y, m, d + 1)) };
}
