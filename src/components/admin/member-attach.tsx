"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { attachMemberToQuote } from "@/app/admin/quote/[id]/actions";

export type MemberOption = {
  id: string;
  memberCode: string;
  label: string;
};

export function MemberAttach({
  quoteId,
  current,
  options,
  locked,
}: {
  quoteId: string;
  current: MemberOption | null;
  options: MemberOption[];
  locked: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(memberId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await attachMemberToQuote(quoteId, memberId);
      if (!result.ok) setError(result.error);
    });
  }

  if (current) {
    return (
      <div className="mt-5 border-t border-ink-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
              — Member
            </p>
            <Link
              href={`/admin/member/${current.id}`}
              className="mt-1 inline-block font-mono text-[12px] tracking-[0.04em] text-clearance hover:underline"
            >
              {current.memberCode} · {current.label}
            </Link>
          </div>
          {!locked ? (
            <button
              type="button"
              onClick={() => run(null)}
              disabled={pending}
              className="rounded-[2px] border border-ink-4 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2 transition-colors hover:border-bone-2 hover:text-bone disabled:opacity-60"
            >
              {pending ? "…" : "Detach"}
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--error)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-ink-3 pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
        — Member · not linked
      </p>
      <div className="mt-2 flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={pending || locked}
          aria-label="Member to attach"
          className="min-w-0 flex-1 rounded-[2px] border border-ink-3 bg-ink-2 px-3 py-1.5 font-mono text-[11px] tracking-[0.04em] text-bone disabled:opacity-60"
        >
          <option value="">Select member…</option>
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.memberCode} · {m.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => selected && run(selected)}
          disabled={pending || locked || !selected}
          className="rounded-[2px] border border-ink-4 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2 transition-colors hover:border-bone-2 hover:text-bone disabled:opacity-60"
        >
          {pending ? "…" : "Attach"}
        </button>
      </div>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-steel">
        Required before convert-to-trip — verify identity off-channel; never trust the typed email alone.
      </p>
      {error ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
