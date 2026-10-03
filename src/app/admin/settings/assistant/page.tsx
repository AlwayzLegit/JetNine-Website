import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { whenWords } from "@/lib/desk-history";
import { MEMORY_CAP, type AgentRunItem, type PlaybookJob, type RunItemKind } from "@/db/schema/agent";
import {
  currentPlaybook,
  dayKeyLA,
  getRun,
  listMemory,
  listPlaybookVersions,
  listRuns,
  missedRunDays,
  type RunRow,
} from "@/domain/agent/queries";
import { STARTER_GENERAL_MD, STARTER_JOBS } from "@/domain/agent/starter-playbook";
import { listTeam } from "@/domain/settings/queries";
import { DeskEmpty, DeskGroup, DeskHeader, DeskRow, DeskTabs, DotSentence, StatusPill } from "@/components/admin/desk-ui";
import { MemoryList, type MemoryRowData } from "@/components/admin/settings/memory-list";
import { PlaybookEditor } from "@/components/admin/settings/playbook-editor";
import { DismissRunItem } from "@/components/admin/settings/run-item-dismiss";

export const dynamic = "force-dynamic";

/**
 * Settings › Assistant (owners). Three tabs: Today (the latest run and the
 * run log), Instructions (the playbook, versioned) and Memory (what the
 * assistant keeps between runs). Server component; the forms are client
 * components fed plain props.
 */

const BASE = "/admin/settings/assistant";
const TABS = [
  { key: "today", label: "Today" },
  { key: "instructions", label: "Instructions" },
  { key: "memory", label: "Memory" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const LA = "America/Los_Angeles";
const CLOCK = new Intl.DateTimeFormat("en-US", { timeZone: LA, hour: "numeric", minute: "2-digit" });
const DAY_SHORT = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const DAY_LONG = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const DAY_FULL = new Intl.DateTimeFormat("en-US", { timeZone: LA, month: "short", day: "numeric", year: "numeric" });
const DAY_THIS_YEAR = new Intl.DateTimeFormat("en-US", { timeZone: LA, month: "short", day: "numeric" });

/** "Oct 2" this year, "Oct 2, 2025" otherwise. */
function dateWords(d: Date, today: string): string {
  return dayKeyLA(d).slice(0, 4) === today.slice(0, 4) ? DAY_THIS_YEAR.format(d) : DAY_FULL.format(d);
}

/** "Today" / "Yesterday" / "Oct 1" for a YYYY-MM-DD run date. */
function dayWords(key: string, today: string): string {
  if (key === today) return "Today";
  const d = new Date(`${key}T00:00:00Z`);
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return (key.slice(0, 4) === today.slice(0, 4) ? DAY_SHORT : DAY_LONG).format(d);
}

/** "9:05 AM" for today, else "Oct 1, 9:05 AM". */
function clockWords(d: Date, today: string): string {
  return dayKeyLA(d) === today ? CLOCK.format(d) : whenWords(d);
}

function runTone(status: RunRow["status"]): { tone: "success" | "gold" | "danger"; label: string } {
  if (status === "closed") return { tone: "success", label: "Done" };
  if (status === "open") return { tone: "gold", label: "Running" };
  return { tone: "danger", label: "Failed" };
}

function firstLine(md: string | null): string {
  const line = md?.split("\n").find((l) => l.trim());
  return line ? line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim() : "";
}

function paragraphs(md: string): string[] {
  return md
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);
}

const KIND_WORDS: Record<RunItemKind, string> = {
  post: "Published",
  flag: "Flagged",
  draft: "Drafted",
  note: "Noted",
  insight: "Insight",
  proposal: "Proposed",
};
const KIND_ORDER: RunItemKind[] = ["post", "flag", "draft", "note", "insight", "proposal"];
const DISMISSABLE: ReadonlySet<RunItemKind> = new Set(["flag", "note", "draft"]);

type Search = { tab?: string; run?: string };
type Props = { searchParams: Promise<Search> };

export default async function AssistantPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "today";

  return (
    <div>
      <DeskHeader
        title="Assistant"
        lead="Runs once a day through its API key. Here is what it did, its instructions, and what it remembers."
      />
      <DeskTabs className="mt-6" items={[...TABS]} current={tab} base={BASE} />
      {tab === "today" ? <TodayTab selectedRun={sp.run} /> : tab === "instructions" ? <InstructionsTab /> : <MemoryTab />}
    </div>
  );
}

// ─── Today ──────────────────────────────────────────────────────────────

async function TodayTab({ selectedRun }: { selectedRun?: string }) {
  const now = new Date();
  const today = dayKeyLA(now);
  const [runs, playbook] = await Promise.all([listRuns({ limit: 14 }), currentPlaybook()]);

  if (runs.length === 0) {
    return (
      <DeskEmpty
        className="mt-6"
        title="No runs yet."
        body={
          <>
            The assistant&apos;s first run will show here. Its prompt is in <code className="text-bone-2">docs/AGENT_HANDOFF.md</code> and
            its key under API keys.
          </>
        }
      />
    );
  }

  const latest = runs[0];
  const selected = selectedRun && runs.some((r) => r.id === selectedRun) ? await getRun(selectedRun) : null;
  const team = selected?.items.some((i) => i.dismissedBy) ? await listTeam() : [];
  const names = new Map(team.map((t) => [t.id, t.name]));
  const jobNames = new Map(playbook.jobs.map((j) => [j.slug, j.name]));

  // Days in the last week with no finished run (from the database, not just the rows shown).
  const missed = (await missedRunDays(now)).map((key) => dayWords(key, today));

  return (
    <>
      <LatestRun run={latest} today={today} jobNames={jobNames} />

      {missed.length ? <p className="mt-4 text-[14px] text-steel">No run on {missed.join(", ")}.</p> : null}

      <DeskGroup title="Run log" count={runs.length} className="mt-8">
        {runs.map((r) => {
          const open = selected?.id === r.id;
          const s = runTone(r.status);
          const line = firstLine(r.summaryMd);
          return (
            <div key={r.id} className={`border-b border-line-faint last:border-b-0 ${open ? "bg-surface-2/30" : ""}`}>
              <DeskRow
                href={open ? `${BASE}?tab=today` : `${BASE}?tab=today&run=${r.id}`}
                cols="md:grid-cols-[150px_minmax(0,1fr)_auto]"
                className="!border-b-0"
              >
                <div className="text-[16px] font-medium text-bone">
                  {dayWords(r.runDate, today)}
                  <div className="text-[13px] font-normal text-steel">{clockWords(r.startedAt, today)}</div>
                </div>
                <div className="min-w-0 text-[15px] text-bone-2">
                  <StatusPill tone={s.tone}>{s.label}</StatusPill>
                  {line ? <div className="mt-1.5 truncate">{line}</div> : null}
                </div>
                <div className="text-[14px] text-steel">
                  {r.itemCount} {r.itemCount === 1 ? "item" : "items"}
                  <span aria-hidden="true" className="ml-2">
                    {open ? "−" : "+"}
                  </span>
                </div>
              </DeskRow>
              {open && selected ? <RunItems items={selected.items} names={names} /> : null}
            </div>
          );
        })}
      </DeskGroup>
    </>
  );
}

function LatestRun({ run, today, jobNames }: { run: RunRow; today: string; jobNames: Map<string, string> }) {
  const errors = run.report?.errors ?? [];
  const reason = errors[0] ?? firstLine(run.summaryMd) ?? "";
  const started = clockWords(run.startedAt, today);
  const closed = run.closedAt ? clockWords(run.closedAt, today) : null;
  const status =
    run.status === "open"
      ? { tone: "gold" as const, words: `Running since ${started}` }
      : run.status === "closed"
        ? { tone: "success" as const, words: `Finished at ${closed ?? started}` }
        : { tone: "danger" as const, words: `Failed at ${closed ?? started}${reason ? `: ${reason}` : ""}` };
  const paras = run.status === "failed" ? [] : paragraphs(run.summaryMd ?? "");
  const jobs = run.report?.jobs ?? [];
  const metrics = Object.entries(run.metrics ?? {});

  return (
    <section className="card mt-6 p-5 md:p-6" aria-labelledby="latest-run">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="latest-run" className="label-jn text-[13px]">
          {run.runDate === today ? "Today" : `Latest run · ${dayWords(run.runDate, today)}`}
        </h2>
        <DotSentence tone={status.tone} className="text-[15px] text-bone">
          {status.words}
        </DotSentence>
      </div>

      {paras.length ? (
        <div className="mt-4 flex flex-col gap-3">
          {paras.map((p, i) => (
            <p key={i} className="whitespace-pre-line text-[15px] leading-[1.55] text-bone">
              {p}
            </p>
          ))}
        </div>
      ) : run.status === "open" ? (
        <p className="mt-4 text-[15px] text-bone-2">Still working. The summary arrives when it closes the run.</p>
      ) : run.status === "closed" ? (
        <p className="mt-4 text-[15px] text-bone-2">It closed the run without a summary.</p>
      ) : null}

      {metrics.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {metrics.map(([k, v]) => (
            <span key={k} className="pill">
              {k}: {String(v)}
            </span>
          ))}
        </div>
      ) : null}

      {jobs.length ? (
        <div className="mt-6 border-t border-line-faint pt-5">
          <h3 className="label-jn text-[13px]">Jobs</h3>
          <ul className="mt-3 flex flex-col gap-4">
            {jobs.map((j) => (
              <li key={j.slug}>
                <div className="text-[16px] font-medium text-bone">{jobNames.get(j.slug) ?? j.slug}</div>
                <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-[14px] md:grid-cols-[64px_minmax(0,1fr)]">
                  <JobLine label="Did" text={j.did} />
                  <JobLine label="Worked" text={j.worked} />
                  <JobLine label="Didn't" text={j.didnt} />
                  <JobLine label="Next" text={j.next} />
                </dl>
                {j.metrics && Object.keys(j.metrics).length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(j.metrics).map(([k, v]) => (
                      <span key={k} className="pill">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {errors.length ? (
        <div className="mt-6 border-t border-line-faint pt-5">
          <h3 className="label-jn text-[13px] text-danger">
            {errors.length === 1 ? "1 error" : `${errors.length} errors`}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-danger">
            {errors.map((e, i) => (
              <li key={i} className="whitespace-pre-wrap">
                {e}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function JobLine({ label, text }: { label: string; text?: string }) {
  if (!text?.trim()) return null;
  return (
    <>
      <dt className="text-steel">{label}</dt>
      <dd className="whitespace-pre-wrap text-bone-2">{text}</dd>
    </>
  );
}

function RunItems({ items, names }: { items: AgentRunItem[]; names: Map<string, string> }) {
  if (items.length === 0) {
    return <p className="border-t border-line-faint px-5 py-4 text-[14px] text-steel md:px-6">Nothing recorded for this run.</p>;
  }
  const groups = KIND_ORDER.map((k) => ({ kind: k, items: items.filter((i) => i.kind === k) })).filter((g) => g.items.length);
  return (
    <div className="border-t border-line-faint px-5 pb-5 pt-1 md:px-6">
      {groups.map((g) => (
        <div key={g.kind} className="mt-4">
          <h3 className="label-jn text-[13px]">
            {KIND_WORDS[g.kind]} <span className="text-steel-dim">· {g.items.length}</span>
          </h3>
          <ul className="mt-2 flex flex-col gap-3">
            {g.items.map((it) => (
              <li key={it.id} className="rounded-control border border-line-faint px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 text-[15px] font-medium text-bone">
                    {it.url && it.url.startsWith("/") && !it.url.startsWith("//") && !it.url.startsWith("/\\") ? (
                      <Link href={it.url} className="text-link-strong">
                        {it.title}
                      </Link>
                    ) : it.url?.startsWith("https://") ? (
                      <a href={it.url} className="text-link-strong" target="_blank" rel="noopener noreferrer">
                        {it.title}
                      </a>
                    ) : (
                      it.title
                    )}
                    {it.subjectCode ? <span className="ml-2 font-mono text-[13px] font-normal text-steel">{it.subjectCode}</span> : null}
                  </div>
                  <div className="flex items-center gap-3 text-[13px] text-steel">
                    <span>
                      {it.status === "dismissed"
                        ? `dismissed by ${(it.dismissedBy && names.get(it.dismissedBy)) ?? "a teammate"}`
                        : it.status}
                    </span>
                    {it.status === "open" && DISMISSABLE.has(it.kind) ? <DismissRunItem id={it.id} /> : null}
                  </div>
                </div>
                {it.bodyMd ? <p className="mt-1.5 line-clamp-6 whitespace-pre-wrap text-[14px] leading-[1.5] text-bone-2">{it.bodyMd}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── Instructions ───────────────────────────────────────────────────────

async function InstructionsTab() {
  const [playbook, versions, team] = await Promise.all([currentPlaybook(), listPlaybookVersions(), listTeam()]);
  const today = dayKeyLA(new Date());
  const names = new Map(team.map((t) => [t.id, t.name]));
  const current = versions.find((v) => v.version === playbook.version);
  const earlier = versions.filter((v) => v.version !== playbook.version);

  const headline = playbook.starter
    ? "Built-in starter instructions · not yet saved"
    : [
        `Version ${playbook.version}`,
        `saved ${dateWords(playbook.createdAt, today)}${current?.createdBy ? ` by ${names.get(current.createdBy) ?? "a former owner"}` : ""}`,
        playbook.note,
      ]
        .filter(Boolean)
        .join(" · ");

  const strip = (jobs: PlaybookJob[]) =>
    jobs.map((j) => ({
      slug: j.slug,
      name: j.name,
      enabled: j.enabled,
      cadence: j.cadence,
      ...(j.weekday !== undefined ? { weekday: j.weekday } : {}),
      instructionsMd: j.instructionsMd,
    }));

  return (
    <>
      <p className="mt-6 text-[15px] text-bone-2">{headline}</p>
      <PlaybookEditor
        initial={{ generalMd: playbook.generalMd, jobs: strip(playbook.jobs) }}
        starter={{ generalMd: STARTER_GENERAL_MD, jobs: strip(STARTER_JOBS) }}
      />

      {earlier.length ? (
        <DeskGroup title="Earlier versions" count={earlier.length} className="mt-8">
          {earlier.map((v) => (
            <DeskRow key={v.version} cols="md:grid-cols-[120px_minmax(0,1fr)_auto]">
              <div className="text-[16px] font-medium text-bone">Version {v.version}</div>
              <div className="min-w-0 truncate text-[15px] text-bone-2">{v.note ?? <span className="text-steel">No note</span>}</div>
              <div className="text-[14px] text-steel">
                {dateWords(v.createdAt, today)}
                {v.createdBy ? ` by ${names.get(v.createdBy) ?? "a former owner"}` : ""}
              </div>
            </DeskRow>
          ))}
        </DeskGroup>
      ) : null}
    </>
  );
}

// ─── Memory ─────────────────────────────────────────────────────────────

async function MemoryTab() {
  const rows = await listMemory({ includeArchived: true });
  const now = new Date();
  const toRow = (m: (typeof rows)[number]): MemoryRowData => ({
    id: m.id,
    kind: m.kind,
    body: m.body,
    pinned: m.pinned,
    byWords: m.author === "agent" ? "by the assistant" : "by you",
    updatedWords: whenWords(m.updatedAt, now),
  });
  const active = rows.filter((m) => !m.archivedAt).map(toRow);
  const archived = rows.filter((m) => m.archivedAt).map(toRow);
  return <MemoryList items={active} archived={archived} cap={MEMORY_CAP} />;
}
