import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contactInquiries } from "@/db/schema/contact";
import { users } from "@/db/schema/users";
import { setInquiryStatus } from "./actions";

export const dynamic = "force-dynamic";

const REASON_CLASS: Record<string, string> = {
  quote: "border-clearance text-clearance",
  card: "border-bone-2 text-bone",
  trip: "border-[var(--success)] text-[var(--success)]",
  other: "border-ink-4 text-bone-2",
};

function relativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

type Props = { searchParams: Promise<{ show?: string }> };

export default async function InquiriesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const showHandled = sp.show === "all";

  const rows = await db
    .select({
      id: contactInquiries.id,
      reason: contactInquiries.reason,
      firstName: contactInquiries.firstName,
      lastName: contactInquiries.lastName,
      email: contactInquiries.email,
      phone: contactInquiries.phone,
      fromText: contactInquiries.fromText,
      toText: contactInquiries.toText,
      dateText: contactInquiries.dateText,
      paxText: contactInquiries.paxText,
      notes: contactInquiries.notes,
      memberId: contactInquiries.memberId,
      status: contactInquiries.status,
      handledAt: contactInquiries.handledAt,
      createdAt: contactInquiries.createdAt,
      handledByEmail: users.email,
    })
    .from(contactInquiries)
    .leftJoin(users, eq(users.id, contactInquiries.handledByUserId))
    .where(showHandled ? undefined : eq(contactInquiries.status, "new"))
    .orderBy(desc(contactInquiries.createdAt))
    .limit(100);

  return (
    <div className="container-jn py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="caption mb-3">— Admin · contact inquiries</p>
          <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
            Written inquiries off the contact page.
          </h1>
          <p className="mt-3 max-w-[64ch] text-[14px] leading-[1.55] text-bone-2">
            The form promises a reply within 30 minutes during business hours, two after. Work
            newest-first; mark handled once the reply is out the door.
          </p>
        </div>
        <Link
          href={showHandled ? "/admin/inquiries" : "/admin/inquiries?show=all"}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
        >
          {showHandled ? "← Open only" : "Show handled too →"}
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-12 text-center">
          <p className="caption mb-3">— Desk is clear</p>
          <p className="text-[14px] leading-[1.55] text-bone-2">
            {showHandled
              ? "Nothing has come in through the contact form yet."
              : "No open inquiries. New submissions land here the moment they're sent."}
          </p>
        </div>
      ) : (
        <div className="rounded-[4px] border border-ink-3 bg-ink-2">
          <ul className="divide-y divide-ink-3">
            {rows.map((r) => {
              const fullName = `${r.firstName} ${r.lastName}`.trim();
              const route =
                r.fromText || r.toText ? `${r.fromText ?? "—"} → ${r.toText ?? "—"}` : null;
              return (
                <li
                  key={r.id}
                  className="grid grid-cols-1 gap-4 px-6 py-6 lg:grid-cols-[120px_1fr_auto] lg:items-start lg:gap-8"
                >
                  <div className="flex flex-col gap-2">
                    <span
                      className={[
                        "inline-flex w-fit rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em]",
                        REASON_CLASS[r.reason] ?? REASON_CLASS.other,
                      ].join(" ")}
                    >
                      {r.reason}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                      {relativeTime(r.createdAt)}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-bone">
                      {fullName}
                      {r.memberId ? (
                        <span className="ml-3 font-mono text-[9px] uppercase tracking-[0.14em] text-clearance">
                          member
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 font-mono text-[11px] tracking-[0.02em] text-bone-2">
                      <a href={`mailto:${r.email}`} className="hover:text-clearance">
                        {r.email}
                      </a>
                      {r.phone ? ` · ${r.phone}` : ""}
                    </p>
                    {route ? (
                      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-bone">
                        {route}
                        {r.dateText ? ` · ${r.dateText}` : ""}
                        {r.paxText ? ` · ${r.paxText}` : ""}
                      </p>
                    ) : null}
                    {r.notes ? (
                      <p className="mt-2 max-w-[72ch] text-[13px] leading-[1.55] text-bone-2">
                        {r.notes}
                      </p>
                    ) : null}
                    {r.status === "handled" ? (
                      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-steel">
                        handled{r.handledByEmail ? ` by ${r.handledByEmail}` : ""}
                        {r.handledAt
                          ? ` · ${r.handledAt.toISOString().slice(0, 16).replace("T", " ")}z`
                          : ""}
                      </p>
                    ) : null}
                  </div>

                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      await setInquiryStatus(formData);
                    }}
                  >
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={r.status === "new" ? "handled" : "new"}
                    />
                    <button
                      type="submit"
                      className={r.status === "new" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                    >
                      {r.status === "new" ? "Mark handled" : "Reopen"}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
