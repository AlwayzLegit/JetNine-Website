"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { attachMemberToQuote } from "@/app/admin/requests/[id]/actions";

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
      <div>
        <p className="text-[15px] text-bone">
          Linked to {current.label}
          <span className="text-[13px] text-steel"> · {current.memberCode}</span>
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          <Link href={`/admin/clients/${current.id}`} className="btn btn-secondary btn-sm">
            Client page
          </Link>
          {!locked ? (
            <button
              type="button"
              onClick={() => run(null)}
              disabled={pending}
              className="btn btn-secondary btn-sm disabled:cursor-wait"
            >
              {pending ? "Unlinking…" : "Unlink"}
            </button>
          ) : null}
        </div>
        {locked ? (
          <p className="mt-2 text-[13px] text-steel">Locked — this request already became a trip.</p>
        ) : null}
        {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className={`field-jn ${error ? "error" : ""}`}>
        <label htmlFor={`member-${quoteId}`}>Client record</label>
        <select
          id={`member-${quoteId}`}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={pending || locked}
          className="disabled:opacity-60"
        >
          <option value="">Pick a client…</option>
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · {m.memberCode}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => selected && run(selected)}
        disabled={pending || locked || !selected}
        className="btn btn-secondary btn-sm self-start disabled:cursor-not-allowed"
      >
        {pending ? "Linking…" : "Link this client"}
      </button>
      <p className="text-[13px] leading-[1.45] text-steel">
        Needed before a booking can be confirmed. Check who they are off-channel — never trust the typed
        email alone.
      </p>
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
