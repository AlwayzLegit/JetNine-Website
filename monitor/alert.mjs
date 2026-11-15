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

/** Subject and text from the fixed check names only. Never a response body. */
export function composeAlert(event, site) {
  const list = (event.checks ?? []).join(", ") || "no check named";
  if (event.type === "recovery") {
    return { subject: `[JetNine monitor] recovered: ${site}`, text: `The site is answering again. It was failing: ${list}.` };
  }
  const again = event.type === "reminder" ? " (still failing)" : "";
  return {
    subject: `[JetNine monitor] DOWN${again}: ${site}`,
    text: `These checks fail from outside the site: ${list}. The status page has the details: ${site.replace(/\/$/, "")} monitor /status.`,
  };
}

/** Returns "sent", "skipped" or "failed". Never throws and never logs a secret or an address. */
export async function sendAlert(env, event, fetchImpl = fetch, log = console.log) {
  if (!alertsConfigured(env)) {
    log("monitor: alert not sent, mail secrets not set");
    return "skipped";
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
      return "failed";
    }
    return "sent";
  } catch {
    log("monitor: alert failed, no answer from the provider");
    return "failed";
  }
}
