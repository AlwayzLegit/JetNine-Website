"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createVoiceAgent } from "./actions";

type Row = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isLive: boolean;
  archived: boolean;
  updatedAt: string;
};

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function AgentsList({ agents }: { agents: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = agents.filter((a) => !a.archived);
  const archived = agents.filter((a) => a.archived);
  const live = active.find((a) => a.isLive);

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await createVoiceAgent({ name: String(data.get("name") ?? ""), fromAgentId: String(data.get("from") ?? "") });
      if (!r.ok) setError(r.error);
      else if (r.id) router.push(`/admin/settings/voice/agents/${r.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {!live ? (
        <p className="card bg-panel px-5 py-3.5 text-[14px] text-bone-2">
          No agent is live yet, so calls use the built-in defaults. Create an agent, check its settings, then press
          &ldquo;Make live&rdquo;.
        </p>
      ) : null}

      <section className="card bg-panel overflow-hidden">
        {active.length === 0 ? (
          <p className="px-6 py-5 text-[15px] text-steel">No agents yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {active.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/settings/voice/agents/${a.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-4 hover:bg-surface-2/50"
                >
                  <span className="text-[15px] font-semibold text-bone">{a.name}</span>
                  {a.isLive ? (
                    <span className="rounded-pill bg-success/10 px-2 py-0.5 text-[12px] font-semibold text-success">Live</span>
                  ) : null}
                  <span className="text-[13px] text-steel">
                    Version {a.version} · saved {WHEN.format(new Date(a.updatedAt))}
                  </span>
                  {a.description ? <span className="w-full text-[14px] text-bone-2">{a.description}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card bg-panel p-6">
        <h2 className="title-card-sm text-bone">New agent</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-2.5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="field-jn">
            <label htmlFor="agent-name">Name</label>
            <input id="agent-name" name="name" required maxLength={80} placeholder="Concierge" />
          </div>
          <div className="field-jn">
            <label htmlFor="agent-from">Start from</label>
            <select id="agent-from" name="from" defaultValue={live?.id ?? ""}>
              <option value="">The default settings</option>
              {active.map((a) => (
                <option key={a.id} value={a.id}>
                  A copy of {a.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? "Creating…" : "Create agent"}
          </button>
        </form>
        {error ? (
          <p role="status" className="mt-3 text-[14px] text-danger">
            {error}
          </p>
        ) : null}
      </section>

      {archived.length > 0 ? (
        <details className="card bg-panel px-6 py-4">
          <summary className="cursor-pointer text-[14px] text-steel">Archived · {archived.length}</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {archived.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/settings/voice/agents/${a.id}`} className="text-link text-[14px]">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
