/**
 * Email alerts for the monitor (OPS-60). Sent only after quietUntil (round.mjs
 * emits no event before it) and only when ALERT_EMAIL and one of RESEND_API_KEY
 * or POSTMARK_SERVER_TOKEN are set, the two providers src/lib/email.ts supports.
 * Without them the monitor records and logs one line with no address in it.
 */
export const DEFAULT_FROM = "JetNine <dispatch@jetnine.com>";

export function alertsConfigured(env) {
  return Boolean(env.ALERT_EMAIL && (env.RESEND_API_KEY || env.POSTMARK_SERVER_TOKEN));
}

const pacific = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** "2026-11-18 07:22 UTC (Nov 17, 2026, 11:22 PM PST)" from a time in ms; "an unknown time" when it is not one. */
export function formatWhen(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || Math.abs(ms) > 8_640_000_000_000_000) return "an unknown time";
  const utc = new Date(ms).toISOString().slice(0, 16).replace("T", " ");
  return `${utc} UTC (${pacific.format(new Date(ms))})`;
}

/** Subject and text from the fixed check names and the event's times only. Never a response body. */
export function composeAlert(event, site) {
  const list = (event.checks ?? []).join(", ") || "no check named";
  const status = `The status page has the details: ${site.replace(/\/$/, "")} monitor /status.`;
  if (event.type === "test") {
    return {
      subject: `[JetNine monitor] test: alerts reach you`,
      text: `This is the monitor's weekly test of its alert mail for ${site}, sent at ${formatWhen(event.at)}. Nothing is wrong. If you did not get this in your inbox (or spam) within a few minutes, alerts do not reach you.`,
    };
  }
  if (event.type === "recovery") {
    return {
      subject: `[JetNine monitor] recovered: ${site}`,
      text: `The site is answering again. It was failing: ${list}. Down from ${formatWhen(event.from)} to ${formatWhen(event.to)}.`,
    };
  }
  const again = event.type === "reminder";
  return {
    subject: `[JetNine monitor] DOWN${again ? " (still failing)" : ""}: ${site}`,
    text: `These checks fail from outside the site: ${list}. ${again ? "Still failing since" : "Failing since"} ${formatWhen(event.from)}. ${status}`,
  };
}

/**
 * Returns { result, code }: result is "sent", "skipped" or "failed"; code is the provider's HTTP
 * status as a number when it answered, else null. Never throws and never logs a secret or an address.
 */
export async function sendAlert(env, event, fetchImpl = fetch, log = console.log) {
  if (!alertsConfigured(env)) {
    log("monitor: alert not sent, mail secrets not set");
    return { result: "skipped", code: null };
  }
  const { subject, text } = composeAlert(event, env.SITE_URL);
  const from = env.ALERT_FROM || DEFAULT_FROM;
  try {
    const res = env.RESEND_API_KEY
      ? await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [env.ALERT_EMAIL], subject, text }),
          signal: AbortSignal.timeout(8000),
        })
      : await fetchImpl("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: { "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ From: from, To: env.ALERT_EMAIL, Subject: subject, TextBody: text }),
          signal: AbortSignal.timeout(8000),
        });
    if (!res.ok) {
      log(`monitor: alert failed, provider answered ${res.status}`);
      return { result: "failed", code: res.status };
    }
    return { result: "sent", code: res.status };
  } catch {
    log("monitor: alert failed, no answer from the provider");
    return { result: "failed", code: null };
  }
}
