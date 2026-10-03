import Link from "next/link";
import type { ApprovalRow } from "@/domain/approvals/queries";
import { approvalUrl } from "@/domain/ops/registry";
import { relativeTime } from "@/lib/request-format";
import { DeskCard } from "@/components/admin/desk-ui";
import { riskPillWord } from "@/components/admin/messages/words";
import { proposerName } from "./shape";

/**
 * "Needs your OK" on a request or trip page: one compact line per proposal
 * the assistant made about this subject, each with a "Decide" link to the
 * Messages tab. Renders nothing when there is nothing waiting.
 */
export function PendingApprovalsCard({ items, now, className = "" }: { items: ApprovalRow[]; now: Date; className?: string }) {
  if (items.length === 0) return null;
  return (
    <DeskCard title="Needs your OK" className={className}>
      <ul className="mt-3 flex flex-col divide-y divide-line-faint">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] leading-[1.45] text-bone">{a.summary}</span>
                <span className="pill pill-outline h-5 px-2 text-[11px] text-bone-2">{riskPillWord(a.risk)}</span>
              </div>
              <div className="mt-0.5 text-[13px] text-steel">
                Proposed by {proposerName(a)} · {relativeTime(a.createdAt, now)}
              </div>
            </div>
            <Link href={approvalUrl(a.id)} className="text-link whitespace-nowrap text-[14px]">
              Decide
            </Link>
          </li>
        ))}
      </ul>
    </DeskCard>
  );
}
