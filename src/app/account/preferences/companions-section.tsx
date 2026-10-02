"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addCompanion, deleteCompanion } from "./actions";
import type { Companion } from "@/db/schema/member-prefs";
import { PreferencesToggle } from "@/components/account/preferences-toggle";
import { PreferencesFeedback, errorSentence, type Feedback } from "@/components/account/preferences-feedback";

const RELATIONS = [
  { id: "spouse", label: "Spouse" },
  { id: "family", label: "Family" },
  { id: "business", label: "Business" },
  { id: "assistant", label: "Assistant" },
  { id: "pet", label: "Pet" },
  { id: "other", label: "Other" },
] as const;

const RELATION_WORDS: Record<string, string> = Object.fromEntries(RELATIONS.map((r) => [r.id, r.label]));

const BORN = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function born(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : BORN.format(d);
}

type Props = { initial: Companion[] };

/**
 * "Companions" card: the people and pets who fly with you, plus the add
 * form. Same `addCompanion` / `deleteCompanion` actions as before.
 */
export function CompanionsSection({ initial }: Props) {
  const [list, setList] = useState<Companion[]>(initial);
  const [relation, setRelation] = useState<string>("spouse");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Feedback>(null);

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
        setMsg({ tone: "ok", text: "Added." });
        form.reset();
        setRelation("spouse");
      } else {
        setMsg({ tone: "error", text: errorSentence(result.error) });
      }
    });
  }

  function onDelete(id: string) {
    setMsg(null);
    startTransition(async () => {
      const result = await deleteCompanion(id);
      if (result.ok) {
        setList((prev) => prev.filter((c) => c.id !== id));
        setMsg({ tone: "ok", text: "Removed." });
      } else {
        setMsg({ tone: "error", text: errorSentence(result.error) });
      }
    });
  }

  return (
    <section className="card card-pad">
      <h2 className="title-card-sm text-bone">Companions</h2>
      <p className="mt-1 max-w-[60ch] text-[15px] leading-[1.5] text-bone-2">
        Spouses, family, assistants, pets — the people who fly with you. Stored encrypted and used
        to pre-fill passenger lists and itinerary copies.
      </p>

      {list.length === 0 ? (
        <p className="mt-6 text-[15px] leading-[1.55] text-bone-2">
          No companions yet. Add the people and pets who fly with you so the passenger list is
          ready before each trip.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line-faint border-y border-line-faint">
          {list.map((c) => {
            const facts: string[] = [RELATION_WORDS[c.relation] ?? "Companion"];
            const b = born(c.birthDate);
            if (b) facts.push(`born ${b}`);
            if (c.relation === "pet" && c.speciesBreed) {
              facts.push(c.weightLb ? `${c.speciesBreed}, ${c.weightLb} lb` : c.speciesBreed);
            }
            if (c.ccOnItinerary) facts.push("copied on itineraries");
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
                <div className="min-w-0">
                  <div className="text-[17px] font-medium text-bone">{c.legalName}</div>
                  <div className="mt-0.5 text-[14px] text-bone-2">{facts.join(" · ")}</div>
                  {c.notes ? <div className="mt-1 text-[14px] leading-[1.5] text-steel">{c.notes}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  disabled={pending}
                  className="text-link min-h-[44px] text-[15px] disabled:cursor-wait disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={onAdd} className="mt-6">
        <h3 className="label-jn text-[13px]">Add a companion</h3>
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <div className="field-jn">
            <label htmlFor="cp-relation">Relationship</label>
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
            <label htmlFor="cp-legalName">{isPet ? "Name" : "Legal name (as on passport)"}</label>
            <input id="cp-legalName" name="legalName" type="text" placeholder="Alex Q. Member" required maxLength={120} />
          </div>
          {!isPet ? (
            <div className="field-jn">
              <label htmlFor="cp-birthDate">Birth date</label>
              <input id="cp-birthDate" name="birthDate" type="date" />
            </div>
          ) : (
            <>
              <div className="field-jn">
                <label htmlFor="cp-speciesBreed">Species or breed</label>
                <input id="cp-speciesBreed" name="speciesBreed" type="text" placeholder="Labrador retriever" maxLength={80} />
              </div>
              <div className="field-jn">
                <label htmlFor="cp-weightLb">Weight (lb)</label>
                <input id="cp-weightLb" name="weightLb" type="number" min={1} max={250} />
              </div>
            </>
          )}
          <div className="field-jn md:col-span-2">
            <label htmlFor="cp-notes">Notes (optional)</label>
            <textarea
              id="cp-notes"
              name="notes"
              rows={2}
              placeholder="Anxious flier — a hello from the crew before boarding helps."
              maxLength={400}
            />
          </div>
        </div>
        <div className="mt-2.5">
          <PreferencesToggle
            name="ccOnItinerary"
            label="Copy on every itinerary email"
            defaultChecked={false}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line-faint pt-5">
          <button type="submit" disabled={pending} className="btn btn-primary disabled:cursor-wait">
            {pending ? "Saving…" : "Add companion"} <span className="arrow">→</span>
          </button>
          {msg ? (
            <PreferencesFeedback msg={msg} />
          ) : (
            <p className="text-[14px] text-steel">
              Encrypted at rest. Dispatch sees these only on confirmed bookings.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
