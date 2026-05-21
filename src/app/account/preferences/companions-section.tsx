"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addCompanion, deleteCompanion } from "./actions";
import type { Companion } from "@/db/schema/member-prefs";

const RELATIONS = [
  { id: "spouse", label: "Spouse" },
  { id: "family", label: "Family" },
  { id: "business", label: "Business" },
  { id: "assistant", label: "Assistant" },
  { id: "pet", label: "Pet" },
  { id: "other", label: "Other" },
] as const;

type Props = { initial: Companion[] };

export function CompanionsSection({ initial }: Props) {
  const [list, setList] = useState<Companion[]>(initial);
  const [relation, setRelation] = useState<string>("spouse");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const isPet = relation === "pet";

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);

    startTransition(async () => {
      const result = await addCompanion(data);
      if (result.ok) {
        // We don't have the full row back; refetch via revalidatePath happens
        // server-side. Optimistic-add minimal shape:
        const optimistic: Companion = {
          id: result.id,
          memberId: "", // unused for display
          relation: data.get("relation") as Companion["relation"],
          legalName: (data.get("legalName") as string) ?? "",
          birthDate: (data.get("birthDate") as string) || null,
          ktnEnc: null,
          apisComplete: false,
          ccOnItinerary: data.get("ccOnItinerary") === "on",
          speciesBreed: (data.get("speciesBreed") as string) || null,
          weightLb: data.get("weightLb") ? Number(data.get("weightLb")) : null,
          notes: (data.get("notes") as string) || null,
          createdAt: new Date(),
        };
        setList((prev) => [...prev, optimistic]);
        setMsg({ tone: "ok", text: "ADDED — saved to your manifest defaults." });
        form.reset();
        setRelation("spouse");
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  function onDelete(id: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteCompanion(id);
      if (result.ok) {
        setList((prev) => prev.filter((c) => c.id !== id));
        setMsg({ tone: "ok", text: "REMOVED." });
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {list.length === 0 ? (
        <p className="rounded-[2px] border border-dashed border-ink-3 bg-ink-2 p-6 font-mono text-[11px] uppercase tracking-[0.1em] text-bone-2">
          — No companions on file. Add spouse, kids, assistants, or pets so manifests pre-populate
          and APIS doesn&rsquo;t need a fresh start every leg.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-[2px] border border-ink-3 bg-ink-2 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-[17px] text-bone">{c.legalName}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                    — {c.relation}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                  {c.birthDate ? `DOB ${c.birthDate}` : "— DOB pending"}
                  {c.ccOnItinerary ? " · CC on itinerary" : ""}
                  {c.relation === "pet" && c.speciesBreed
                    ? ` · ${c.speciesBreed}${c.weightLb ? ` · ${c.weightLb} lb` : ""}`
                    : ""}
                </div>
                {c.notes ? (
                  <div className="mt-2 text-[12px] leading-[1.5] text-bone-2">{c.notes}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                disabled={pending}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-[var(--error)] disabled:cursor-wait disabled:opacity-50"
              >
                Remove →
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={onAdd}
        className="rounded-[2px] border border-ink-3 bg-ink-2 p-5"
      >
        <p className="caption mb-4">— Add companion</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="field-jn">
            <label htmlFor="cp-relation">Relation</label>
            <select
              id="cp-relation"
              name="relation"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              required
            >
              {RELATIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field-jn">
            <label htmlFor="cp-legalName">Legal name (as on passport)</label>
            <input
              id="cp-legalName"
              name="legalName"
              type="text"
              placeholder="Alex Q. Member"
              required
              maxLength={120}
            />
          </div>
          {!isPet ? (
            <div className="field-jn">
              <label htmlFor="cp-birthDate">Birth date</label>
              <input id="cp-birthDate" name="birthDate" type="date" />
            </div>
          ) : (
            <>
              <div className="field-jn">
                <label htmlFor="cp-speciesBreed">Species / breed</label>
                <input
                  id="cp-speciesBreed"
                  name="speciesBreed"
                  type="text"
                  placeholder="Labrador retriever"
                  maxLength={80}
                />
              </div>
              <div className="field-jn">
                <label htmlFor="cp-weightLb">Weight (lb)</label>
                <input id="cp-weightLb" name="weightLb" type="number" min={1} max={250} />
              </div>
            </>
          )}
        </div>
        <div className="field-jn mt-4">
          <label htmlFor="cp-notes">Notes (optional)</label>
          <textarea
            id="cp-notes"
            name="notes"
            rows={2}
            placeholder="Anxious flier — pre-flight greeting helps."
            maxLength={400}
          />
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3">
          <input type="checkbox" name="ccOnItinerary" className="h-4 w-4 accent-clearance" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
            CC on every itinerary email
          </span>
        </label>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
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
              — Encrypted at rest; dispatcher sees these only on confirmed bookings.
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add companion"} <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
