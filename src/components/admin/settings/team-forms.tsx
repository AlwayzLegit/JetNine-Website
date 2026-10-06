"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { DeskRole } from "@/lib/desk-status";
import { DeskHeader } from "@/components/admin/desk-ui";
import {
  inviteTeammate,
  removeTeammate,
  setTeammateRole,
  type TeamActionResult,
} from "@/app/admin/settings/team/actions";

type Msg = { tone: "ok" | "error"; text: string } | null;

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role="status" className={`text-[14px] ${msg.tone === "ok" ? "text-success" : "text-danger"}`}>
      {msg.text}
    </p>
  );
}

/**
 * Team header with the "+ Invite someone" action and the invite form it
 * opens (email, first name, last name, role).
 */
export function TeamHeader() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setMsg(null);
    start(async () => {
      const r: TeamActionResult = await inviteTeammate(data);
      if (r.ok) {
        setMsg({ tone: "ok", text: r.message });
        form.reset();
      } else {
        setMsg({ tone: "error", text: r.error });
      }
    });
  }

  return (
    <>
      <DeskHeader size="md"
        title="Team"
        lead="Who can sign in to the desk and what they can see."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            aria-expanded={open}
            aria-controls="team-invite"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "+ Invite someone"}
          </button>
        }
      />
      {open ? (
        <form id="team-invite" onSubmit={onSubmit} className="card bg-[#FBFAF7] mt-6 p-6">
          <h2 className="font-serif text-[20px] leading-[1.2] text-bone">Invite someone to the desk</h2>
          <p className="mt-1 text-[14px] text-steel">
            They get an email with a sign-in link. Owners see everything including reports and money; Team
            handles requests, trips, clients and messages.
          </p>
          <div className="mt-5 grid gap-2.5 md:grid-cols-2">
            <div className="field-jn md:col-span-2">
              <label htmlFor="invite-email">Email</label>
              <input id="invite-email" name="email" type="email" required autoComplete="off" placeholder="name@jetnine.com" />
            </div>
            <div className="field-jn">
              <label htmlFor="invite-first">First name</label>
              <input id="invite-first" name="firstName" type="text" autoComplete="off" maxLength={60} />
            </div>
            <div className="field-jn">
              <label htmlFor="invite-last">Last name</label>
              <input id="invite-last" name="lastName" type="text" autoComplete="off" maxLength={60} />
            </div>
            <div className="field-jn">
              <label htmlFor="invite-role">Role</label>
              <select id="invite-role" name="role" defaultValue="team">
                <option value="team">Team</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "Sending…" : "Send the invite"}
            </button>
            <Message msg={msg} />
          </div>
        </form>
      ) : msg ? (
        <div className="mt-4">
          <Message msg={msg} />
        </div>
      ) : null}
    </>
  );
}

/**
 * The "Change" control on a team row: an inline form with the role select
 * and "Remove from the desk".
 */
export function TeamRowChange({ userId, role, name }: { userId: string; role: DeskRole; name: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const [nextRole, setNextRole] = useState<DeskRole>(role);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await setTeammateRole(userId, nextRole);
      setMsg(r.ok ? { tone: "ok", text: r.message } : { tone: "error", text: r.error });
      if (r.ok) setOpen(false);
    });
  }

  function remove() {
    if (!confirm(`Remove ${name} from the desk? They keep their account but can no longer sign in here.`)) return;
    setMsg(null);
    start(async () => {
      const r = await removeTeammate(userId);
      setMsg(r.ok ? { tone: "ok", text: r.message } : { tone: "error", text: r.error });
      if (r.ok) setOpen(false);
    });
  }

  const selectId = `role-${userId}`;

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <button
        type="button"
        className="text-link text-[14px]"
        aria-expanded={open}
        aria-controls={`change-${userId}`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Cancel" : "Change"}
      </button>
      {open ? (
        <div id={`change-${userId}`} className="flex flex-wrap items-end gap-2.5">
          <div className="field-jn w-[140px]">
            <label htmlFor={selectId}>Role</label>
            <select id={selectId} value={nextRole} onChange={(e) => setNextRole(e.target.value as DeskRole)} disabled={pending}>
              <option value="owner">Owner</option>
              <option value="team">Team</option>
            </select>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={save} disabled={pending || nextRole === role}>
            Save
          </button>
          <button type="button" className="btn btn-sm text-danger" onClick={remove} disabled={pending}>
            Remove from the desk
          </button>
        </div>
      ) : null}
      <Message msg={msg} />
    </div>
  );
}
