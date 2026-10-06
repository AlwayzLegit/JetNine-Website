"use client";

import { useState, useTransition, type FormEvent } from "react";
import { savePlaybookAction } from "@/app/admin/settings/assistant/actions";

/**
 * Settings › Assistant › Instructions. The owner edits the general
 * instructions and one card per job, says what changed, and saves a new
 * version. Everything here is plain props: the page does the dates and the
 * permission check, the Server Action validates.
 */

export type EditorJob = {
  slug: string;
  name: string;
  enabled: boolean;
  cadence: "daily" | "weekdays" | "weekly" | "manual";
  weekday?: number;
  instructionsMd: string;
};

export type EditorPlaybook = { generalMd: string; jobs: EditorJob[] };

type Draft = EditorJob & { key: string; saved: boolean };

const CADENCES: { value: EditorJob["cadence"]; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Once a week" },
  { value: "manual", label: "Only when asked" },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

let seq = 0;
function nextKey(): string {
  seq += 1;
  return `job-${seq}`;
}

function toDrafts(jobs: EditorJob[], saved: boolean): Draft[] {
  return jobs.map((j) => ({ ...j, key: nextKey(), saved }));
}

function rowsFor(text: string, min: number, max = 40): number {
  return Math.min(max, Math.max(min, text.split("\n").length + 1));
}

export function PlaybookEditor({ initial, starter }: { initial: EditorPlaybook; starter: EditorPlaybook }) {
  const [generalMd, setGeneralMd] = useState(initial.generalMd);
  // Jobs that arrive with a slug keep it (reports and run items refer to it); new jobs take theirs from the name.
  const [jobs, setJobs] = useState<Draft[]>(() => toDrafts(initial.jobs, true));
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function patch(key: string, change: Partial<Draft>) {
    setJobs((list) => list.map((j) => (j.key === key ? { ...j, ...change } : j)));
  }

  function addJob() {
    setJobs((list) => [...list, { key: nextKey(), slug: "", name: "", enabled: true, cadence: "daily", instructionsMd: "", saved: false }]);
  }

  function removeJob(key: string) {
    setJobs((list) => list.filter((j) => j.key !== key));
  }

  function fillFromStarter() {
    setGeneralMd(starter.generalMd);
    setJobs(toDrafts(starter.jobs, true));
    setMsg(null);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    if (!generalMd.trim()) return setMsg({ tone: "error", text: "The general instructions can't be empty." });
    for (const j of jobs) {
      if (!j.name.trim()) return setMsg({ tone: "error", text: "Every job needs a name." });
      if (!j.slug) return setMsg({ tone: "error", text: `Give “${j.name}” a name with letters or numbers in it.` });
      if (!j.instructionsMd.trim()) return setMsg({ tone: "error", text: `“${j.name}” needs instructions.` });
      if (j.cadence === "weekly" && j.weekday === undefined) return setMsg({ tone: "error", text: `Pick a weekday for “${j.name}”.` });
    }
    if (!note.trim()) return setMsg({ tone: "error", text: "Say what changed, in one line." });

    const data = new FormData();
    data.set("generalMd", generalMd);
    data.set("note", note.trim());
    data.set(
      "jobs",
      JSON.stringify(
        jobs.map((j) => ({
          slug: j.slug,
          name: j.name.trim(),
          enabled: j.enabled,
          cadence: j.cadence,
          ...(j.cadence === "weekly" ? { weekday: j.weekday } : {}),
          instructionsMd: j.instructionsMd,
        })),
      ),
    );
    start(async () => {
      const r = await savePlaybookAction(data);
      if (r.ok) {
        setMsg({ tone: "ok", text: `Saved as version ${r.version}. The assistant reads it on its next run.` });
        setNote("");
        setJobs((list) => list.map((j) => ({ ...j, saved: true })));
      } else {
        setMsg({ tone: "error", text: r.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-6">
      <section className="card bg-[#FBFAF7] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold">General instructions</h2>
          <button type="button" className="text-link text-[14px]" onClick={fillFromStarter} disabled={pending}>
            Start from the starter instructions
          </button>
        </div>
        <p className="mt-1.5 text-[14px] text-steel">How the assistant works, whatever the job. It reads this first on every run.</p>
        <div className="field-jn mt-4">
          <label htmlFor="pb-general">Instructions</label>
          <textarea
            id="pb-general"
            value={generalMd}
            onChange={(e) => setGeneralMd(e.target.value)}
            rows={rowsFor(generalMd, 10)}
            maxLength={12000}
            disabled={pending}
            className="resize-y !font-mono !text-[14px] !leading-[1.55] disabled:opacity-60"
          />
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center justify-between gap-4">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold">
            Jobs <span className="text-steel-dim">· {jobs.length}</span>
          </h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addJob} disabled={pending || jobs.length >= 20}>
            Add a job
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="card bg-[#FBFAF7] p-6 text-[15px] text-bone-2">No jobs. The assistant will open a run, find nothing to do and close it.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {jobs.map((j, i) => (
              <JobCard key={j.key} job={j} index={i} pending={pending} patch={(c) => patch(j.key, c)} remove={() => removeJob(j.key)} />
            ))}
          </div>
        )}
      </section>

      <section className="card bg-[#FBFAF7] p-5 md:p-6">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-gold">Save</h2>
        <div className="field-jn mt-4">
          <label htmlFor="pb-note">What changed</label>
          <input
            id="pb-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            maxLength={300}
            placeholder="Blog job: rotate aircraft topics more often."
            disabled={pending}
            autoComplete="off"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? "Saving…" : "Save as a new version"}
          </button>
          <span className="text-[14px] text-steel">Earlier versions are kept; nothing is overwritten.</span>
        </div>
        <p role="status" className={`mt-3 text-[14px] ${msg ? (msg.tone === "ok" ? "text-success" : "text-danger") : "sr-only"}`}>
          {msg?.text ?? ""}
        </p>
      </section>
    </form>
  );
}

function JobCard({
  job,
  index,
  pending,
  patch,
  remove,
}: {
  job: Draft;
  index: number;
  pending: boolean;
  patch: (change: Partial<Draft>) => void;
  remove: () => void;
}) {
  const id = `job-${index}`;
  return (
    <section className={`card bg-[#FBFAF7] p-5 md:p-6 ${job.enabled ? "" : "opacity-80"}`} aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="text-[17px] font-medium text-bone">
            {job.name.trim() || "New job"}
          </h3>
          <p className="font-mono text-[13px] text-steel">{job.slug || "slug appears from the name"}</p>
        </div>
        <button type="button" className="text-link text-[14px] text-danger" onClick={remove} disabled={pending}>
          Remove
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto] md:items-end">
        <div className="field-jn">
          <label htmlFor={`${id}-name`}>Name</label>
          <input
            id={`${id}-name`}
            type="text"
            value={job.name}
            maxLength={80}
            required
            disabled={pending}
            autoComplete="off"
            onChange={(e) => patch(job.saved ? { name: e.target.value } : { name: e.target.value, slug: slugify(e.target.value) })}
          />
        </div>
        <div className="field-jn">
          <label htmlFor={`${id}-cadence`}>Runs</label>
          <select
            id={`${id}-cadence`}
            value={job.cadence}
            disabled={pending}
            onChange={(e) => {
              const cadence = e.target.value as EditorJob["cadence"];
              patch({ cadence, weekday: cadence === "weekly" ? (job.weekday ?? 1) : job.weekday });
            }}
          >
            {CADENCES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {job.cadence === "weekly" ? (
          <div className="field-jn">
            <label htmlFor={`${id}-weekday`}>On</label>
            <select id={`${id}-weekday`} value={job.weekday ?? 1} disabled={pending} onChange={(e) => patch({ weekday: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={d}>
                  {WEEKDAYS[d]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="hidden md:block" />
        )}
        <label className="flex h-[46px] cursor-pointer items-center gap-2.5 text-[15px] text-bone">
          <input type="checkbox" checked={job.enabled} disabled={pending} onChange={(e) => patch({ enabled: e.target.checked })} />
          On
        </label>
      </div>

      <div className="field-jn mt-4">
        <label htmlFor={`${id}-instructions`}>Instructions</label>
        <textarea
          id={`${id}-instructions`}
          value={job.instructionsMd}
          maxLength={12000}
          rows={rowsFor(job.instructionsMd, 6)}
          disabled={pending}
          onChange={(e) => patch({ instructionsMd: e.target.value })}
          className="resize-y !font-mono !text-[14px] !leading-[1.55] disabled:opacity-60"
        />
      </div>
    </section>
  );
}
