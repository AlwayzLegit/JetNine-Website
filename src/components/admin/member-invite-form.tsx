"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { inviteMember } from "@/app/admin/member/actions";

const TIERS = [
  { id: "on_demand", label: "On-demand", desc: "No commitment, pay per flight." },
  { id: "card_100", label: "Card · 100", desc: "100 hours pre-paid." },
  { id: "card_250", label: "Card · 250", desc: "250 hours pre-paid." },
  { id: "card_500", label: "Card · 500", desc: "500 hours pre-paid." },
  { id: "reserve_50", label: "Reserve · 50", desc: "$50k deposit, hourly draw." },
  { id: "reserve_100", label: "Reserve · 100", desc: "$100k deposit, hourly draw." },
  { id: "reserve_250", label: "Reserve · 250", desc: "$250k deposit, hourly draw." },
  { id: "reserve_500_apply", label: "Reserve · 500", desc: "$500k — invitation only." },
] as const;

type Success = {
  memberId: string;
  memberCode: string;
  isNewAuthUser: boolean;
};

export function MemberInviteForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await inviteMember(data);
      if (result.ok) {
        setSuccess({
          memberId: result.memberId,
          memberCode: result.memberCode,
          isNewAuthUser: result.isNewAuthUser,
        });
        setMsg({
          tone: "ok",
          text: result.isNewAuthUser
            ? `INVITED — magic link sent · ${result.memberCode}`
            : `LINKED — existing auth user · ${result.memberCode}`,
        });
        form.reset();
      } else {
        setMsg({ tone: "error", text: `BLOCKED — ${result.error.toUpperCase()}` });
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary btn-sm"
      >
        + Invite member <span className="arrow">→</span>
      </button>
    );
  }

  return (
    <div className="rounded-[4px] border border-clearance bg-ink-2 p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="caption text-clearance">— Invite member</h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMsg(null);
            setSuccess(null);
          }}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 hover:text-bone"
        >
          Close ✕
        </button>
      </div>

      {success ? (
        <div className="mb-5 rounded-[2px] border border-[var(--success)] bg-[rgba(120,160,90,0.06)] p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--success)]">
            — Created · {success.memberCode}
          </p>
          <p className="mt-2 text-[13px] leading-[1.55] text-bone-2">
            {success.isNewAuthUser
              ? "Magic-link invitation sent. They sign in once and the profile activates."
              : "Linked to existing auth user. They can sign in immediately."}
          </p>
          <div className="mt-4 flex gap-4">
            <Link
              href={`/admin/member/${success.memberId}`}
              className="btn btn-secondary btn-sm"
            >
              Open profile →
            </Link>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 hover:text-bone"
            >
              Invite another →
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="field-jn md:col-span-2">
            <label htmlFor="im-email">Email</label>
            <input
              id="im-email"
              name="email"
              type="email"
              placeholder="member@example.com"
              required
              maxLength={254}
            />
          </div>
          <div className="field-jn">
            <label htmlFor="im-phone">Phone (E.164)</label>
            <input
              id="im-phone"
              name="phoneE164"
              type="tel"
              placeholder="+15551234567"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="field-jn">
            <label htmlFor="im-firstName">First name</label>
            <input id="im-firstName" name="firstName" type="text" placeholder="Alex" maxLength={80} />
          </div>
          <div className="field-jn">
            <label htmlFor="im-lastName">Last name</label>
            <input id="im-lastName" name="lastName" type="text" placeholder="Member" maxLength={80} />
          </div>
          <div className="field-jn">
            <label htmlFor="im-company">Company (optional)</label>
            <input
              id="im-company"
              name="companyName"
              type="text"
              placeholder="Brookfield Capital"
              maxLength={140}
            />
          </div>
        </div>

        <div className="field-jn">
          <label htmlFor="im-tier">Tier</label>
          <select id="im-tier" name="tier" defaultValue="on_demand" required>
            {TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} — {t.desc}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {msg && !success ? (
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
              — Sends a magic-link invite. Existing auth users are reused. Creates the
              members row + M-YYYY-NNNN code.
            </span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Inviting…" : "Send invite"} <span className="arrow">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
