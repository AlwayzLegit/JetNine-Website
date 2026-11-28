import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildLeadInput, realDeps } from "@/lib/leads/pointer";

// OPS-373: the staging proof of the lead pointer. It sends ONE rehearsal pointer (source Form, kind
// "selftest") through the LEADS binding and answers { ok, pageId } or { ok:false, reason }, so the
// deploy workflow can print "lead pointer selftest: ok" and the row on the Leads board proves the
// path end to end. It holds no visitor data and writes no lead_desk row.
//
// It is refused (404) anywhere LEADS_REHEARSAL is not "1": that is staging only (wrangler.jsonc).
// There is no bearer secret: the deploy workflow holds no CRON_SECRET and a new secret is the
// owner's to add. The risk is a rehearsal row on the board, so it is capped here (3 an hour) and
// by crew-intake's own hourly cap, and the row says rehearsal.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const deps = realDeps();
  if (!deps.rehearsal) return NextResponse.json({ ok: false, reason: "not available" }, { status: 404 });

  const limit = await checkRateLimit("lead_pointer_selftest", { max: 3, windowSeconds: 3600 });
  if (!limit.ok) return NextResponse.json({ ok: false, reason: "rate limited" }, { status: 429 });

  if (!deps.binding) return NextResponse.json({ ok: false, reason: "no LEADS binding" }, { status: 503 });

  const now = new Date();
  const input = buildLeadInput(
    {
      subjectType: "contact",
      subjectId: `selftest-${now.getTime()}`,
      source: "Form",
      kind: "selftest",
      receivedAt: now,
      replyDue: null,
      score: null,
      adminPath: "/admin/messages",
    },
    deps,
  );
  try {
    const r = await deps.binding.createLead(input);
    if (r.ok) return NextResponse.json({ ok: true, pageId: r.pageId });
    return NextResponse.json({ ok: false, reason: String(r.reason).slice(0, 80) }, { status: 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: err instanceof Error ? err.name : "error" }, { status: 502 });
  }
}
