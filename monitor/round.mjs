/**
 * One monitoring round as a pure function (OPS-60): the stored state, the probe
 * results and the time go in; the new state and the alert events come out.
 *
 * A failing round opens an incident and the first passing round closes it. Before
 * quietUntil (a new alarm starts quiet for 24 hours) a failing round is only
 * written to wouldHaveRaised: no incident, no event, no email.
 */
export const MAX_KEPT = 20;
export const REMINDER_MS = 60 * 60 * 1000;

const keep = (list) => list.slice(-MAX_KEPT);

export function nextRound(prev, probes, now, quietUntilMs) {
  const p = prev && typeof prev === "object" ? prev : {};
  const failing = probes.checks.filter((c) => !c.ok).map((c) => c.name);
  const isFailing = failing.length > 0;
  const quiet = now < quietUntilMs;
  const events = [];

  let streak = isFailing ? (Number(p.streak) > 0 ? Number(p.streak) + 1 : 1) : 0;
  let since = isFailing ? (Number(p.streak) > 0 && typeof p.since === "number" ? p.since : now) : null;
  let incidents = Array.isArray(p.incidents) ? p.incidents : [];
  let wouldHaveRaised = Array.isArray(p.wouldHaveRaised) ? p.wouldHaveRaised : [];
  let open = p.open && typeof p.open === "object" ? p.open : null;

  if (quiet) {
    if (isFailing) wouldHaveRaised = keep([...wouldHaveRaised, { at: now, checks: failing }]);
  } else if (isFailing && !open) {
    open = { from: now, checks: failing, rounds: 1, lastAlertAt: now };
    events.push({ type: "start", checks: failing, from: now });
  } else if (isFailing && open) {
    const checks = [...new Set([...(open.checks ?? []), ...failing])];
    open = { ...open, checks, rounds: (open.rounds ?? 1) + 1 };
    if (now - (open.lastAlertAt ?? 0) >= REMINDER_MS) {
      open.lastAlertAt = now;
      events.push({ type: "reminder", checks, from: open.from });
    }
  } else if (!isFailing && open) {
    incidents = keep([...incidents, { from: open.from, to: now, checks: open.checks ?? [], rounds: open.rounds ?? 1 }]);
    events.push({ type: "recovery", checks: open.checks ?? [], from: open.from, to: now });
    open = null;
  }

  return {
    state: {
      checkedAt: now,
      ok: !isFailing,
      streak,
      since,
      checks: probes.checks,
      canary: probes.canary,
      incidents,
      wouldHaveRaised,
      open,
    },
    events,
  };
}
