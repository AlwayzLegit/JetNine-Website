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

const ROW_BTN = "btn btn-secondary h-9 px-3.5 text-[14px] disabled:cursor-wait disabled:opacity-50";

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
        setMsg({ tone: "ok", text: "Added — contact on file." });
        form.reset();
      } else {
        setMsg({ tone: "error", text: result.error });
      }
    });
  }

  function onDelete(contactId: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteOperatorContact(operatorId, contactId);
      if (result.ok) {
        setList((prev) => prev.filter((c) => c.id !== contactId));
        setMsg({ tone: "ok", text: "Removed." });
      } else {
        setMsg({ tone: "error", text: result.error });
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
          text: result.isEscalation ? "Now an escalation contact." : "Now a standard contact.",
        });
      } else {
        setMsg({ tone: "error", text: result.error });
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
        <p className="rounded-control border border-dashed border-line-2 bg-surface-2 p-4 text-[14px] text-bone-2">
          No contacts on file. Add at least one escalation contact before this operator can fly revenue
          trips.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((c) => (
            <li
              key={c.id}
              className={[
                "rounded-control border bg-surface-2 p-4",
                c.isEscalation ? "border-clearance" : "border-line",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[16px] font-medium text-bone">{c.name}</span>
                {c.isEscalation ? <span className="pill pill-clearance">Escalation</span> : null}
              </div>
              {c.role ? <div className="mt-1 text-[14px] text-steel">{c.role}</div> : null}
              <dl className="mt-2 flex flex-col gap-1 text-[14px]">
                {c.email ? (
                  <a href={`mailto:${c.email}`} className="text-link">
                    {c.email}
                  </a>
                ) : null}
                {c.phoneE164 ? (
                  <a href={`tel:${c.phoneE164}`} className="text-link">
                    {c.phoneE164}
                  </a>
                ) : null}
              </dl>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => onToggleEscalation(c.id, !c.isEscalation)}
                  disabled={pending}
                  className={ROW_BTN}
                >
                  {c.isEscalation ? "Make standard" : "Make escalation"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  disabled={pending}
                  className={`${ROW_BTN} text-danger`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAdd} className="rounded-control border border-line bg-surface-2 p-4">
        <h3 className="label-jn mb-3 text-[13px]">Add contact</h3>
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
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="field-jn">
            <label htmlFor="oc-email">Email</label>
            <input id="oc-email" name="email" type="email" placeholder="riley@operator.com" />
          </div>
          <div className="field-jn">
            <label htmlFor="oc-phone">Phone (with country code)</label>
            <input id="oc-phone" name="phoneE164" type="tel" placeholder="+15551234567" />
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-3 py-1">
          <input
            type="checkbox"
            name="isEscalation"
            className="h-4 w-4 accent-clearance"
          />
          <span className="text-[14px] text-bone-2">
            Escalation contact (overnight and weekend pages go here)
          </span>
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {msg ? (
            <span className={`text-[14px] ${msg.tone === "error" ? "text-danger" : "text-success"}`}>
              {msg.text}
            </span>
          ) : (
            <span className="text-[13px] text-steel">
              At least one of email or phone is required. Phone with country code, like +1 555 123 4567.
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
