"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { approveProposal, rejectProposal } from "@/app/admin/approvals/actions";
import { riskPillWord } from "@/components/admin/messages/words";

/**
 * One proposal from the daily assistant, as a person sees it on the
 * Messages › "Needs your OK" tab. Pending: Approve / Edit and approve /
 * Reject. Decided: a read-only line saying what happened. Everything here
 * is plain props — the page does the dates and the permission check.
 */

export type ApprovalCardData = {
  id: string;
  summary: string;
  risk: string;
  status: "pending" | "executing" | "executed" | "failed" | "rejected" | "expired";
  reason: string | null;
  preview: string | null;
  /** Current text of each editable field, by field name. */
  editableText: { field: string; label: string; text: string }[];
  /** "Daily assistant" or the person who proposed it. */
  proposedBy: string;
  /** "Today, 3:12 PM" */
  proposedWhen: string;
  /** "in 6 days" — only while pending. */
  expiresWhen: string | null;
  subject: { href: string; label: string } | null;
  decidedBy: string | null;
  decidedWhen: string | null;
  decisionNote: string | null;
  error: string | null;
  edited: boolean;
  /** False when a team member opens something only an owner may decide. */
  canDecide: boolean;
};

type Mode = "idle" | "edit" | "reject";

function RiskPill({ risk }: { risk: string }) {
  return <span className="pill pill-outline h-6 px-2.5 text-[12px] text-bone-2">{riskPillWord(risk)}</span>;
}

export function ApprovalCard({ data }: { data: ApprovalCardData }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pendingRow = data.status === "pending";
  const goesOut = data.risk === "client";

  function submit(kind: "approve" | "reject", formData: FormData) {
    setError(null);
    start(async () => {
      const r = kind === "approve" ? await approveProposal(data.id, formData) : await rejectProposal(data.id, formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMode("idle");
      setDone(kind === "approve" ? "Approved. It is being carried out." : "Rejected. The assistant will see your note.");
    });
  }

  function onSubmit(kind: "approve" | "reject") {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      submit(kind, new FormData(e.currentTarget));
    };
  }

  return (
    <section className="card p-5 md:p-6" aria-labelledby={`approval-${data.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id={`approval-${data.id}`} className="min-w-0 text-[20px] font-medium leading-[1.3] text-bone">
          {data.summary}
        </h2>
        <RiskPill risk={data.risk} />
      </div>
      <p className="mt-1.5 text-[14px] text-steel">
        Proposed by {data.proposedBy} · {data.proposedWhen}
        {pendingRow && data.expiresWhen ? ` · expires ${data.expiresWhen}` : ""}
        {data.subject ? (
          <>
            {" · "}
            <Link href={data.subject.href} className="text-link">
              {data.subject.label}
            </Link>
          </>
        ) : null}
      </p>

      {data.reason ? (
        <div className="mt-5">
          <h3 className="label-jn text-[13px]">Why</h3>
          <p className="mt-1.5 whitespace-pre-line text-[15px] leading-[1.5] text-bone-2">{data.reason}</p>
        </div>
      ) : null}

      {data.preview && mode !== "edit" ? (
        <div className="mt-5">
          <h3 className="label-jn text-[13px]">{goesOut ? "What goes out" : "What changes"}</h3>
          <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-control border border-line bg-ink px-4 py-3 font-sans text-[15px] leading-[1.55] text-bone">
            {data.preview}
          </pre>
        </div>
      ) : null}

      {pendingRow ? (
        <Pending
          data={data}
          mode={mode}
          setMode={(m) => {
            setError(null);
            setMode(m);
          }}
          pending={pending}
          error={error}
          done={done}
          onSubmit={onSubmit}
        />
      ) : (
        <Decided data={data} />
      )}
    </section>
  );
}

function Pending({
  data,
  mode,
  setMode,
  pending,
  error,
  done,
  onSubmit,
}: {
  data: ApprovalCardData;
  mode: Mode;
  setMode: (m: Mode) => void;
  pending: boolean;
  error: string | null;
  done: string | null;
  onSubmit: (kind: "approve" | "reject") => (e: FormEvent<HTMLFormElement>) => void;
}) {
  const locked = !data.canDecide || pending;
  const canEdit = data.editableText.length > 0;

  if (done) {
    return <p className="mt-6 border-t border-line-faint pt-4 text-[14px] text-success">{done}</p>;
  }

  return (
    <div className="mt-6 border-t border-line-faint pt-5">
      {mode === "edit" ? (
        <form onSubmit={onSubmit("approve")} className="flex flex-col gap-4">
          {data.editableText.map((f) => (
            <div key={f.field} className={`field-jn ${error ? "error" : ""}`}>
              <label htmlFor={`edit-${data.id}-${f.field}`}>{f.label}</label>
              <textarea
                id={`edit-${data.id}-${f.field}`}
                name={`edit:${f.field}`}
                defaultValue={f.text}
                rows={Math.min(14, Math.max(4, f.text.split("\n").length + 1))}
                disabled={locked}
                className="resize-y disabled:opacity-60"
              />
            </div>
          ))}
          <p className="text-[13px] leading-[1.45] text-steel">Change the words, then approve. Only the text above can change.</p>
          <Buttons
            primary={pending ? "Approving…" : "Approve with these changes"}
            locked={locked}
            onCancel={() => setMode("idle")}
          />
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        </form>
      ) : mode === "reject" ? (
        <form onSubmit={onSubmit("reject")} className="flex flex-col gap-4">
          <div className={`field-jn ${error ? "error" : ""}`}>
            <label htmlFor={`note-${data.id}`}>Tell the assistant why, so it learns</label>
            <textarea
              id={`note-${data.id}`}
              name="note"
              rows={3}
              required
              maxLength={1000}
              disabled={locked}
              placeholder="Too soon to contact them — wait for the operator first."
              className="resize-y disabled:opacity-60"
            />
          </div>
          <Buttons primary={pending ? "Rejecting…" : "Reject"} locked={locked} onCancel={() => setMode("idle")} />
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        </form>
      ) : (
        <form onSubmit={onSubmit("approve")} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="submit" disabled={locked} className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? "Approving…" : "Approve"}
            </button>
            {canEdit ? (
              <button
                type="button"
                disabled={locked}
                onClick={() => setMode("edit")}
                className="btn btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Edit and approve
              </button>
            ) : null}
            <button
              type="button"
              disabled={locked}
              onClick={() => setMode("reject")}
              className="btn btn-secondary btn-sm text-danger disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reject
            </button>
          </div>
          {!data.canDecide ? <p className="text-[13px] text-steel">An owner has to decide this one.</p> : null}
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        </form>
      )}
    </div>
  );
}

function Buttons({ primary, locked, onCancel }: { primary: string; locked: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button type="submit" disabled={locked} className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50">
        {primary}
      </button>
      <button type="button" onClick={onCancel} disabled={locked} className="btn btn-secondary btn-sm disabled:opacity-50">
        Cancel
      </button>
    </div>
  );
}

function Decided({ data }: { data: ApprovalCardData }) {
  let words: string;
  let tone = "text-bone";
  switch (data.status) {
    case "executed":
      words = data.edited ? "Approved with edits and done" : "Approved and done";
      tone = "text-success";
      break;
    case "failed":
      words = `Approved but it did not go through${data.error ? `: ${data.error}` : ""}`;
      tone = "text-danger";
      break;
    case "rejected":
      words = `Rejected${data.decisionNote ? `: “${data.decisionNote}”` : ""}`;
      break;
    case "expired":
      words = "Expired before anyone decided";
      tone = "text-steel";
      break;
    default:
      words = "Being carried out now";
      tone = "text-steel";
  }
  const by = data.decidedBy ? ` by ${data.decidedBy}` : "";
  const when = data.decidedWhen ? ` · ${data.decidedWhen}` : "";
  return (
    <div className="mt-6 border-t border-line-faint pt-4">
      <p className={`text-[15px] leading-[1.5] ${tone}`}>{words}</p>
      {data.status !== "executing" && (by || when) ? (
        <p className="mt-1 text-[13px] text-steel">
          {data.status === "expired" ? "Expired" : "Decided"}
          {data.status === "expired" ? "" : by}
          {when}
        </p>
      ) : null}
      {data.status === "executed" && data.decisionNote ? (
        <p className="mt-2 text-[14px] text-bone-2">“{data.decisionNote}”</p>
      ) : null}
    </div>
  );
}
