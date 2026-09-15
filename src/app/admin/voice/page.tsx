import { sql } from "@/db";

export const dynamic = "force-dynamic";

// Read-only surface over the voice agent's call log. The voice service
// (voice/, deployed on Render) writes voice_calls in this same database but
// the desk had no way to see them — outcomes like `message` (a caller left
// a message for a human!) were invisible without a SQL console. There is no
// drizzle schema for the voice tables (they belong to the voice service),
// so this page reads them with the raw postgres client.

type VoiceCallRow = {
  id: string;
  from_number: string | null;
  started_at: Date;
  duration_seconds: number | null;
  outcome: string | null;
  summary: string | null;
  escalation_reason: string | null;
  recording_url: string | null;
  returning_caller: boolean;
  message_reason: string | null;
  message_callback: string | null;
};

const OUTCOME_CLASS: Record<string, string> = {
  lead: "border-[var(--success)] text-[var(--success)]",
  escalated: "border-[var(--warn)] text-[var(--warn)]",
  message: "border-clearance text-clearance",
  abandoned: "border-steel text-steel",
};

function fmtDuration(s: number | null): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default async function AdminVoicePage() {
  let rows: VoiceCallRow[] = [];
  let unavailable = false;
  try {
    rows = await sql<VoiceCallRow[]>`
      select c.id, c.from_number, c.started_at, c.duration_seconds, c.outcome,
             c.summary, c.escalation_reason, c.recording_url, c.returning_caller,
             m.reason as message_reason, m.callback as message_callback
      from public.voice_calls c
      left join lateral (
        select reason, callback from public.voice_messages
        where call_id = c.id
        order by created_at desc limit 1
      ) m on true
      order by c.started_at desc
      limit 50
    `;
  } catch (err) {
    // The voice tables ship with the voice service's migrations; on an
    // environment without them this page degrades to an empty state
    // rather than a crash.
    console.error("[admin/voice] query failed", err);
    unavailable = true;
  }

  return (
    <section className="container-jn py-12">
      <header className="mb-10">
        <p className="caption mb-3">— Voice desk · call log</p>
        <h1 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
          Inbound calls · {rows.length}
        </h1>
        <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.55] text-bone-2">
          The AI voice agent&rsquo;s last 50 calls, newest first. <strong>message</strong> means a
          caller left something for a human — treat those like an unread inbox.
        </p>
      </header>

      {unavailable ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— Unavailable</p>
          <p className="text-[14px] leading-[1.55] text-bone-2">
            The voice tables aren&rsquo;t reachable — check that the voice service&rsquo;s
            migrations ran against this database.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— Empty</p>
          <p className="text-[14px] leading-[1.55] text-bone-2">
            No calls yet. When the Twilio number rings, calls land here with outcome, summary,
            and recording.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 rounded-[4px] border border-ink-3 bg-ink-2 px-6 py-5 md:grid md:grid-cols-[auto_1fr_auto] md:items-start md:gap-6"
            >
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[12px] tracking-[0.04em] text-clearance">
                  {c.from_number ?? "unknown"}
                </span>
                <span className="font-mono text-[10px] tracking-[0.04em] text-bone-2">
                  {c.started_at.toISOString().slice(0, 16).replace("T", " ")}Z ·{" "}
                  {fmtDuration(c.duration_seconds)}
                  {c.returning_caller ? " · returning" : ""}
                </span>
              </div>
              <div>
                <p className="text-[14px] leading-[1.55] text-bone">
                  {c.summary ?? c.escalation_reason ?? "—"}
                </p>
                {c.message_reason ? (
                  <p className="mt-2 rounded-[3px] border border-clearance bg-[rgba(232,226,210,0.05)] px-3 py-2 font-mono text-[11px] leading-[1.5] text-clearance">
                    ✉ Left a message: {c.message_reason}
                    {c.message_callback ? ` · call back: ${c.message_callback}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3 md:flex-col md:items-end">
                <span
                  className={[
                    "inline-block rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                    OUTCOME_CLASS[c.outcome ?? ""] ?? "border-ink-3 text-bone-2",
                  ].join(" ")}
                >
                  {c.outcome ?? "in progress"}
                </span>
                {c.recording_url ? (
                  <a
                    href={c.recording_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2 underline underline-offset-2 transition-colors hover:text-bone"
                  >
                    Recording →
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
