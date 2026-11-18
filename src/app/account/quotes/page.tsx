import Link from "next/link";
import { accountStore } from "@/domain/account/store";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { getReplyPromiseMinutes } from "@/lib/desk-settings";
import { replyPromiseWords } from "@/lib/desk-status";
import { CATEGORY_PLAIN, USD, formatDay } from "@/lib/request-page";
import { statusPath } from "@/lib/request-status";
import { QuoteRow } from "@/components/account/quotes-row";
import { BTN_PRIMARY, EmptyPanel, PageHead } from "@/components/account/panel";
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
  const accounts = accountStore();
  const rows = await accounts.clientQuotes({ owner: { userId: user.id, memberId: member?.id ?? null }, limit: 50 });

  const legs = await accounts.quoteLegsOf(rows.map((r) => r.id));
  const legsByQuote = new Map<string, typeof legs>();
  for (const l of legs) {
    const arr = legsByQuote.get(l.quoteId) ?? [];
    arr.push(l);
    legsByQuote.set(l.quoteId, arr);
  }

  return (
    <>
      <PageHead
        title="Quotes"
        sub={
          <>
            Every request you&rsquo;ve sent, newest first, and where each one stands. Dispatch replies{" "}
            {replyPromiseWords(replyMinutes)} during operating hours.
          </>
        }
        action={
          <Link href="/quote/mission" className={BTN_PRIMARY}>
            New request <span aria-hidden="true">→</span>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyPanel
          title="No quotes yet."
          action={
            <Link href="/quote/mission" className={BTN_PRIMARY}>
              Request a quote <span aria-hidden="true">→</span>
            </Link>
          }
        >
          Tell us where and when, pick an aircraft category, and a senior dispatcher takes it from there.
        </EmptyPanel>
      ) : (
        <ul className="mt-[22px] flex flex-col gap-3">
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
              codes,
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
                  title={routeWords(qLegs)}
                  meta={meta}
                  status={q.status}
                  words={quoteStatusWords(q.status, q.slaDeadlineAt, undefined, replyMinutes)}
                  aside={indicative}
                  code={q.quoteCode}
                />
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3.5 text-[12px] leading-[1.5] text-steel">
        A quote is not a confirmed booking; final terms are in your written confirmation. Need to change or
        cancel a request? Call dispatch — the desk answers 24/7.
      </p>
    </>
  );
}
