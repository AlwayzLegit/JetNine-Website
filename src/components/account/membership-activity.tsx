import Link from "next/link";
import { USD } from "@/lib/request-page";

export type ActivityRow = {
  id: string;
  kind: string;
  amountUsd: number;
  description: string | null;
  /** ISO timestamp — serialisable so the list can render anywhere. */
  occurredAt: string;
  tripId?: string | null;
};

// Ledger kinds as plain words. The enum never reaches the page.
const KIND_WORDS: Record<string, string> = {
  top_up: "Top-up",
  charter_draw: "Flight",
  credit_accrual: "Cashback",
  refund: "Refund",
  adjustment: "Adjustment",
};

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Los_Angeles",
});

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const thisYear = new Date().getFullYear();
  return d.getFullYear() === thisYear ? MONTH_DAY.format(d) : MONTH_DAY_YEAR.format(d);
}

/**
 * Reserve transactions as one-line sentences inside a card:
 * "Top-up · $25,000 · Aug 2" / "Flight · Los Angeles → Aspen · −$11,800".
 * Inflows read in success colour, draws in bone.
 */
export function MembershipActivity({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="card mt-2.5 px-6 py-5 text-[15px] leading-[1.55] text-bone-2">
        Nothing yet. Top-ups, flights drawn from your balance and cashback all show up here.
      </div>
    );
  }
  return (
    <ul className="card mt-2.5 divide-y divide-line-faint">
      {rows.map((tx) => {
        const positive = tx.amountUsd >= 0;
        const amount = `${positive ? "+" : "−"}${USD.format(Math.abs(tx.amountUsd))}`;
        const kind = KIND_WORDS[tx.kind] ?? "Adjustment";
        return (
          <li
            key={tx.id}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4 text-[15px]"
          >
            <div className="min-w-0">
              <span className="font-medium text-bone">{kind}</span>
              {tx.description ? <span className="text-bone-2"> · {tx.description}</span> : null}
              <span className="text-steel"> · {when(tx.occurredAt)}</span>
              {tx.tripId ? (
                <>
                  <span className="text-steel"> · </span>
                  <Link href={`/account/trips/${tx.tripId}`} className="text-link text-[14px]">
                    Trip details
                  </Link>
                </>
              ) : null}
            </div>
            <span className={["tabular-nums", positive ? "text-success" : "text-bone"].join(" ")}>
              {amount}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
