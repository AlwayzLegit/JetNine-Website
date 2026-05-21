"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  addOperatorContact,
  deleteOperatorContact,
  toggleOperatorContactEscalation,
} from "@/app/admin/operators/[id]/actions";
import type { OperatorContact } from "@/db/schema/operators";

type Props = {
  operatorId: string;
  initial: OperatorContact[];
};

export function OperatorContactsEditor({ operatorId, initial }: Props) {
  const [list, setList] = useState<OperatorContact[]>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);

    startTransition(async () => {
      const result = await addOperatorContact(operatorId, data);
      if (result.ok) {
        const optimistic: OperatorContact = {
          id: result.id,
          operatorId,
          name: ((data.get("name") as string) ?? "").trim(),
          role: ((data.get("role") as string) ?? "").trim() || null,
          phoneE164: ((data.get("phoneE164") as string) ?? "").trim() || null,
          email: ((data.get("email") as string) ?? "").trim() || null,
          isEscalation: data.get("isEscalation") === "on",
          createdAt: new Date(),
        };
        setList((prev) => [...prev, optimistic]);
        setMsg({ tone: "ok", text: "ADDED — contact on file." });
        form.reset();
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onDelete(contactId: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteOperatorContact(operatorId, contactId);
      if (result.ok) {
        setList((prev) => prev.filter((c) => c.id !== contactId));
        setMsg({ tone: "ok", text: "REMOVED." });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onToggleEscalation(contactId: string, next: boolean) {
    setMsg(null);
    startTransition(async () => {
      const result = await toggleOperatorContactEscalation(operatorId, contactId, next);
      if (result.ok) {
        setList((prev) =>
          prev.map((c) =>
            c.id === contactId ? { ...c, isEscalation: result.isEscalation } : c,
          ),
        );
        setMsg({
          tone: "ok",
          text: result.isEscalation ? "PROMOTED — escalation contact." : "DEMOTED — standard contact.",
        });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  // Escalation contacts first, then alpha by name — matches the page-side sort.
  const sorted = [...list].sort((a, b) => {
    if (a.isEscalation !== b.isEscalation) return a.isEscalation ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-4">
      {sorted.length === 0 ? (
        <p className="rounded-[2px] border border-dashed border-ink-3 bg-ink p-4 font-mono text-[10px] uppercase tracking-[0.1em] text-bone-2">
          — No contacts on file. Add at least one escalation contact before this operator can fly
          revenue trips.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((c) => (
            <li
              key={c.id}
              className={[
                "rounded-[3px] border bg-ink p-3",
                c.isEscalation ? "border-clearance" : "border-ink-3",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-serif text-[15px] text-bone">{c.name}</span>
                {c.isEscalation ? (
                  <span className="rounded-[2px] bg-clearance px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-ink">
                    Escalation
                  </span>
                ) : null}
              </div>
              {c.role ? (
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                  {c.role}
                </div>
              ) : null}
              <dl className="mt-2 flex flex-col gap-1 text-[11px]">
                {c.email ? (
                  <a
                    href={`mailto:${c.email}`}
                    className="font-mono tracking-[0.04em] text-clearance hover:underline"
                  >
                    {c.email}
                  </a>
                ) : null}
                {c.phoneE164 ? (
                  <a
                    href={`tel:${c.phoneE164}`}
                    className="font-mono tracking-[0.04em] text-clearance hover:underline"
                  >
                    {c.phoneE164}
                  </a>
                ) : null}
              </dl>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-3 pt-3">
                <button
                  type="button"
                  onClick={() => onToggleEscalation(c.id, !c.isEscalation)}
                  disabled={pending}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance disabled:cursor-wait disabled:opacity-50"
                >
                  {c.isEscalation ? "Demote ↓" : "Promote ↑"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  disabled={pending}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-[var(--error)] disabled:cursor-wait disabled:opacity-50"
                >
                  Remove →
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAdd} className="rounded-[3px] border border-ink-3 bg-ink p-4">
        <p className="caption mb-3">— Add contact</p>
        <div className="field-jn">
          <label htmlFor="oc-name">Name</label>
          <input id="oc-name" name="name" type="text" placeholder="Riley Chen" required maxLength={120} />
        </div>
        <div className="field-jn mt-3">
          <label htmlFor="oc-role">Role (optional)</label>
          <input
            id="oc-role"
            name="role"
            type="text"
            placeholder="Director of operations"
            maxLength={80}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 mt-3">
          <div className="field-jn">
            <label htmlFor="oc-email">Email</label>
            <input id="oc-email" name="email" type="email" placeholder="riley@operator.com" />
          </div>
          <div className="field-jn">
            <label htmlFor="oc-phone">Phone (E.164)</label>
            <input id="oc-phone" name="phoneE164" type="tel" placeholder="+15551234567" />
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="isEscalation"
            className="h-4 w-4 accent-clearance"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
            Escalation contact (overnight + weekend pages route here)
          </span>
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {msg ? (
            <span
              className={[
                "font-mono text-[11px] uppercase tracking-[0.12em]",
                msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]",
              ].join(" ")}
            >
              {msg.text}
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              — At least one of email or phone required. E.164 format for phone.
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add contact"} <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
