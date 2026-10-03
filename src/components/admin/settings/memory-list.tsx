"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addMemoryAction, updateMemoryAction } from "@/app/admin/settings/assistant/actions";

/**
 * Settings › Assistant › Memory. What the assistant remembers between
 * runs: pinned first, then by last change. Owners add notes, pin, edit and
 * archive. Plain props only; the page does the dates.
 */

export type MemoryRowData = {
  id: string;
  kind: "fact" | "lesson" | "preference" | "todo";
  body: string;
  pinned: boolean;
  /** "by the assistant" or "by you". */
  byWords: string;
  /** "Today, 9:40 AM" */
  updatedWords: string;
};

export const MEMORY_KIND_WORDS: Record<MemoryRowData["kind"], string> = {
  fact: "Fact",
  lesson: "Lesson",
  preference: "Preference",
  todo: "To do",
};

type Msg = { tone: "ok" | "error"; text: string } | null;

function KindPill({ kind }: { kind: MemoryRowData["kind"] }) {
  return <span className="pill pill-outline h-6 px-2.5 text-[12px] text-bone-2">{MEMORY_KIND_WORDS[kind]}</span>;
}

export function MemoryList({ items, archived, cap }: { items: MemoryRowData[]; archived: MemoryRowData[]; cap: number }) {
  return (
    <div className="mt-6">
      <AddMemory />

      <section className="mt-8">
        <div className="mb-2.5 flex items-center justify-between gap-4">
          <h2 className="label-jn text-[13px]">
            Remembered <span className="text-steel-dim">· {items.length}</span>
          </h2>
          <span className="text-[13px] text-steel">
            {items.length} of {cap} slots used.
          </span>
        </div>
        {items.length === 0 ? (
          <p className="card p-6 text-[15px] text-bone-2">Nothing remembered yet. The assistant adds a few items after each run; you can add one above.</p>
        ) : (
          <div className="card overflow-hidden">
            {items.map((m) => (
              <MemoryRow key={m.id} item={m} />
            ))}
          </div>
        )}
      </section>

      {archived.length ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-[15px] text-bone-2">Archived ({archived.length})</summary>
          <div className="card mt-3 overflow-hidden">
            {archived.map((m) => (
              <div key={m.id} className="border-b border-line-faint px-5 py-4 last:border-b-0 md:px-6">
                <div className="flex flex-wrap items-center gap-2.5">
                  <KindPill kind={m.kind} />
                  <span className="text-[13px] text-steel">
                    {m.byWords} · {m.updatedWords}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.5] text-bone-2">{m.body}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function AddMemory() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setMsg(null);
    start(async () => {
      const r = await addMemoryAction(data);
      if (r.ok) {
        setBody("");
        setMsg({ tone: "ok", text: "Added. The assistant sees it on its next run." });
      } else {
        setMsg({ tone: "error", text: r.error });
      }
    });
  }

  return (
    <section className="card p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="label-jn text-[13px]">Add a note for the assistant</h2>
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open} aria-controls="memory-add" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "+ Add a note"}
        </button>
      </div>
      <p className="mt-1.5 text-[14px] text-steel">A fact about the desk, a lesson, a preference, or something to do. Short, 600 characters at most.</p>
      {open ? (
        <form id="memory-add" onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <div className="field-jn">
            <label htmlFor="memory-kind">Kind</label>
            <select id="memory-kind" name="kind" defaultValue="fact" disabled={pending}>
              {(Object.keys(MEMORY_KIND_WORDS) as MemoryRowData["kind"][]).map((k) => (
                <option key={k} value={k}>
                  {MEMORY_KIND_WORDS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="field-jn">
            <label htmlFor="memory-body">Note</label>
            <textarea
              id="memory-body"
              name="body"
              rows={3}
              required
              maxLength={600}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={pending}
              placeholder="Owners prefer Monday posts about empty legs."
              className="resize-y disabled:opacity-60"
            />
            <div className="mt-1 text-right text-[12px] text-steel">{body.length}/600</div>
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "Adding…" : "Add"}
            </button>
            <p role="status" className={`text-[14px] ${msg ? (msg.tone === "ok" ? "text-success" : "text-danger") : "sr-only"}`}>
              {msg?.text ?? ""}
            </p>
          </div>
        </form>
      ) : msg ? (
        <p role="status" className={`mt-3 text-[14px] ${msg.tone === "ok" ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}

function MemoryRow({ item }: { item: MemoryRowData }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send(fields: Record<string, string>, after?: () => void) {
    setError(null);
    start(async () => {
      const data = new FormData();
      for (const [k, v] of Object.entries(fields)) data.set(k, v);
      const r = await updateMemoryAction(item.id, data);
      if (r.ok) after?.();
      else setError(r.error);
    });
  }

  function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.trim()) return setError("The note can't be empty.");
    send({ body: draft }, () => setEditing(false));
  }

  return (
    <div className="border-b border-line-faint px-5 py-4 last:border-b-0 md:px-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <KindPill kind={item.kind} />
        {item.pinned ? <span className="text-[13px] text-gold">Pinned</span> : null}
        <span className="text-[13px] text-steel">
          {item.byWords} · {item.updatedWords}
        </span>
      </div>

      {editing ? (
        <form onSubmit={saveEdit} className="mt-3">
          <div className={`field-jn ${error ? "error" : ""}`}>
            <label htmlFor={`memory-edit-${item.id}`} className="sr-only">
              Note
            </label>
            <textarea
              id={`memory-edit-${item.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(10, Math.max(3, draft.split("\n").length + 1))}
              maxLength={600}
              required
              disabled={pending}
              className="resize-y disabled:opacity-60"
            />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={pending}
              onClick={() => {
                setDraft(item.body);
                setError(null);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.5] text-bone">{item.body}</p>
      )}

      {!editing ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[14px]">
          <button type="button" className="text-link" disabled={pending} onClick={() => send({ pinned: item.pinned ? "false" : "true" })}>
            {item.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            className="text-link"
            disabled={pending}
            onClick={() => {
              setDraft(item.body);
              setError(null);
              setEditing(true);
            }}
          >
            Edit
          </button>
          <button type="button" className="text-link" disabled={pending} onClick={() => send({ archived: "true" })}>
            Archive
          </button>
          {pending ? <span className="text-[13px] text-steel">Saving…</span> : null}
        </div>
      ) : null}
      {error ? (
        <p role="status" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
