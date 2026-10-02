import Link from "next/link";
import { asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { getReplyPromiseMinutes } from "@/lib/desk-settings";
import { replyPromiseWords } from "@/lib/desk-status";
import { CATEGORY_PLAIN, USD, formatDay } from "@/lib/request-page";
import { statusPath } from "@/lib/request-status";
import { QuoteRow } from "@/components/account/quotes-row";
import { quoteStatusWords } from "@/components/account/quotes-status";
import { routeWords } from "@/components/account/trips-status";

export const dynamic = "force-dynamic";

export default async function AccountQuotesPage() {
  await requireUser("/account/quotes");
  const user = await getCurrentUser();
  if (!user) return null;

  // Quotes are linked to the member row when one exists, and to the auth user
  // when a signed-in visitor submits before dispatch creates their member
  // profile — cover both.
  const member = await getMemberByUserId(user.id);
  // Reply-time promise from the desk setting (Settings › Notifications).
  const replyMinutes = await getReplyPromiseMinutes();
  const ownership = member
    ? or(eq(quotes.createdByUserId, user.id), eq(quotes.memberId, member.id))
    : eq(quotes.createdByUserId, user.id);

  const rows = await db
    .select({
      id: quotes.id,
      quoteCode: quotes.quoteCode,
      status: quotes.status,
      statusToken: quotes.statusToken,
      paxCount: quotes.paxCount,
      requestedCategory: quotes.requestedCategory,
      receivedAt: quotes.receivedAt,
      slaDeadlineAt: quotes.slaDeadlineAt,
      indicativeLowUsd: quotes.indicativeLowUsd,
      indicativeHighUsd: quotes.indicativeHighUsd,
    })
    .from(quotes)
    .where(ownership)
    .orderBy(desc(quotes.receivedAt))
    .limit(50);

  const ids = rows.map((r) => r.id);
  const legs = ids.length
    ? await db
        .select({
          quoteId: quoteLegs.quoteId,
          legNumber: quoteLegs.legNumber,
          fromIata: quoteLegs.fromIata,
          toIata: quoteLegs.toIata,
          fromCity: quoteLegs.fromCity,
          toCity: quoteLegs.toCity,
          departDate: quoteLegs.departDate,
        })
        .from(quoteLegs)
        .where(inArray(quoteLegs.quoteId, ids))
        .orderBy(asc(quoteLegs.legNumber))
    : [];
  const legsByQuote = new Map<string, typeof legs>();
  for (const l of legs) {
    const arr = legsByQuote.get(l.quoteId) ?? [];
    arr.push(l);
    legsByQuote.set(l.quoteId, arr);
  }

  return (
    <>
      <h1 className="title-app">Your quotes</h1>
      <p className="mt-2.5 text-[17px] text-bone-2">
        Every request you&rsquo;ve sent, newest first. Dispatch replies {replyPromiseWords(replyMinutes)} during
        operating hours — open a row to track it.
      </p>

      {rows.length === 0 ? (
        <div className="card mt-8 p-7 max-md:p-5">
          <h2 className="title-card-sm text-bone">No quotes yet.</h2>
          <p className="mt-2 max-w-[52ch] text-bone-2">
            Tell us where and when, pick an aircraft category, and a senior dispatcher takes it from
            there.
          </p>
          <Link href="/quote/mission" className="btn btn-primary mt-5">
            Request a quote <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-2">
          {rows.map((q) => {
            const qLegs = legsByQuote.get(q.id) ?? [];
            const first = qLegs[0];
            const codes =
              first?.fromIata || first?.toIata ? `${first.fromIata ?? "—"} → ${first.toIata ?? "—"}` : null;
            const category = q.requestedCategory ? CATEGORY_PLAIN[q.requestedCategory]?.toLowerCase() : null;
            const meta = [
              formatDay(first?.departDate) ?? "date to be confirmed",
              `${q.paxCount} passenger${q.paxCount === 1 ? "" : "s"}`,
              category,
            ]
              .filter(Boolean)
              .join(" · ");
            const indicative =
              q.indicativeLowUsd && q.indicativeHighUsd
                ? `${USD.format(q.indicativeLowUsd)} – ${USD.format(q.indicativeHighUsd)}`
                : null;
            return (
              <li key={q.id}>
                <QuoteRow
                  href={q.statusToken ? statusPath(q.statusToken) : null}
                  title={
                    <>
                      {routeWords(qLegs)}
                      {codes ? <span className="font-normal text-steel"> · {codes}</span> : null}
                    </>
                  }
                  meta={meta}
                  status={quoteStatusWords(q.status, q.slaDeadlineAt, undefined, replyMinutes)}
                  aside={indicative}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[15px] text-steel">
          Need to change or cancel a request? Call dispatch — the desk answers 24/7.
        </p>
        {rows.length > 0 ? (
          <Link href="/quote/mission" className="btn btn-secondary">
            Request a quote <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </>
  );
}
