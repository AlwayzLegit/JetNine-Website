"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { inviteMember } from "@/app/admin/clients/actions";
import { TIER_WORDS } from "@/lib/desk-status";

const TIER_NOTES: Record<string, string> = {
  on_demand: "pay per flight",
  card_100: "100 hours pre-paid",
  card_250: "250 hours pre-paid",
  card_500: "500 hours pre-paid",
  reserve_50: "$50k deposit",
  reserve_100: "$100k deposit",
  reserve_250: "$250k deposit",
  reserve_500_apply: "$500k, by invitation",
};

const TIERS = Object.keys(TIER_WORDS);

type Success = {
  memberId: string;
  memberCode: string;
  isNewAuthUser: boolean;
};

/**
 * "+ Invite a client" — a primary button that opens a panel under the
 * header (a `<details>`, so it works before hydration). Same fields and the
 * same `inviteMember` action as before; the words are the desk's.
 */
export function MemberInviteForm({ label = "+ Invite a client" }: { label?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const details = useRef<HTMLDetailsElement>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await inviteMember(data);
      if (result.ok) {
        setSuccess({
          memberId: result.memberId,
          memberCode: result.memberCode,
          isNewAuthUser: result.isNewAuthUser,
        });
        form.reset();
      } else {
        setError(result.error);
      }
    });
  }

  function close() {
    if (details.current) details.current.open = false;
    setError(null);
    setSuccess(null);
  }

  return (
    <details ref={details} className="relative max-lg:w-full">
      <summary className="btn btn-primary w-max cursor-pointer list-none whitespace-nowrap [&::-webkit-details-marker]:hidden">
        {label}
      </summary>

      <div className="card z-30 mt-2.5 p-6 lg:absolute lg:right-0 lg:top-full lg:w-[680px] lg:shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-medium text-bone">Invite a client</h2>
            <p className="mt-1 text-[14px] text-steel">
              They get an email with a sign-in link. If they already have a sign-in, it is reused.
            </p>
          </div>
          <button type="button" onClick={close} className="btn btn-secondary btn-sm">
            Close
          </button>
        </div>

        {success ? (
          <div className="mt-5 rounded-control border border-line bg-surface-2 p-4">
            <p className="text-[15px] text-bone">
              {success.isNewAuthUser
                ? "Invite sent. They sign in once from the email and the client page fills in."
                : "Linked to their existing sign-in. They can sign in right away."}
            </p>
            <p className="mt-1 text-[13px] text-steel">Reference {success.memberCode}</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link href={`/admin/clients/${success.memberId}`} className="btn btn-primary btn-sm">
                Open the client page
              </Link>
              <button type="button" onClick={() => setSuccess(null)} className="btn btn-secondary btn-sm">
                Invite another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              <div className="field-jn md:col-span-2">
                <label htmlFor="im-email">Email</label>
                <input
                  id="im-email"
                  name="email"
                  type="email"
                  placeholder="dana@example.com"
                  required
                  maxLength={254}
                  autoComplete="off"
                />
              </div>
              <div className="field-jn">
                <label htmlFor="im-phone">Phone</label>
                <input
                  id="im-phone"
                  name="phoneE164"
                  type="tel"
                  placeholder="+13105550142"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              <div className="field-jn">
                <label htmlFor="im-firstName">First name</label>
                <input id="im-firstName" name="firstName" type="text" placeholder="Dana" maxLength={80} />
              </div>
              <div className="field-jn">
                <label htmlFor="im-lastName">Last name</label>
                <input id="im-lastName" name="lastName" type="text" placeholder="Whitfield" maxLength={80} />
              </div>
              <div className="field-jn">
                <label htmlFor="im-company">Company (optional)</label>
                <input id="im-company" name="companyName" type="text" placeholder="Whitfield Partners" maxLength={140} />
              </div>
            </div>

            <div className="field-jn">
              <label htmlFor="im-tier">Membership</label>
              <select id="im-tier" name="tier" defaultValue="on_demand" required>
                {TIERS.map((id) => (
                  <option key={id} value={id}>
                    {TIER_WORDS[id]}
                    {TIER_NOTES[id] ? ` — ${TIER_NOTES[id]}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {error ? (
                <p className="text-[14px] text-danger" role="alert">
                  {error}
                </p>
              ) : (
                <p className="text-[14px] text-steel">Phone with the country code first, like +13105550142.</p>
              )}
              <button type="submit" disabled={pending} className="btn btn-primary">
                {pending ? "Sending…" : "Send the invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </details>
  );
}
