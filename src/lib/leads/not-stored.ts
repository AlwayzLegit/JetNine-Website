// A lead that could not be stored (OPS-373, the OPS-347 pattern). The visitor still sees the same
// error as before. The desk inbox gets one alert with what the visitor typed, so the desk can reply
// by hand, and the Leads board gets a pointer with status Not stored and no personal data.
//
// If email runs in logger mode (no provider key) or fails, the alert did not reach anyone: that is
// counted as a failed alert and the board row is marked Missed with the reason Alert failed.
import { sendDispatchAlert } from "@/lib/email";
import {
  afterResponse,
  markAlertFailedWith,
  realDeps,
  sendPointerWith,
  type LeadSourceWord,
  type LeadSubject,
  type PointerDeps,
} from "./pointer";

export type NotStoredArgs = {
  subjectType: LeadSubject;
  source: LeadSourceWord;
  /** "a quote request" or "a contact enquiry" */
  what: string;
  kind: string;
  /** What the visitor typed, for the desk only. Never sent to the board, never logged. */
  fields: string[];
  receivedAt: Date;
  replyDue: Date | null;
};

export async function reportNotStoredWith(
  deps: PointerDeps,
  alert: typeof sendDispatchAlert,
  args: NotStoredArgs,
): Promise<{ alertOk: boolean; pageId: string | null }> {
  const subjectId = `ns-${crypto.randomUUID()}`;
  let alertOk = false;
  try {
    const r = await alert({
      subject: `Not stored: ${args.what}`,
      headline: `${args.what[0].toUpperCase()}${args.what.slice(1)} could not be saved. The visitor saw an error.`,
      lines: [
        "The database did not take it. This is what the visitor typed; reply to them by hand.",
        ...args.fields.filter(Boolean),
      ],
    });
    alertOk = r.ok && r.provider !== "logger";
  } catch {
    alertOk = false;
  }
  const pageId = await sendPointerWith(deps, {
    subjectType: args.subjectType,
    subjectId,
    source: args.source,
    kind: `${args.kind} not stored`,
    receivedAt: args.receivedAt,
    replyDue: args.replyDue,
    score: null,
    adminPath: args.subjectType === "quote" ? "/admin/requests" : "/admin/messages",
    status: "Not stored",
  });
  if (!alertOk && pageId) await markAlertFailedWith(deps, subjectId);
  if (!alertOk) console.warn("[leads] not-stored alert did not reach the desk inbox");
  return { alertOk, pageId };
}

/** Never throws; runs after the response where the platform allows it. */
export function reportNotStored(args: NotStoredArgs): Promise<void> {
  return afterResponse(reportNotStoredWith(realDeps(), sendDispatchAlert, args));
}
