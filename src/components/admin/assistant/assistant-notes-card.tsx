import Link from "next/link";
import type { RunItemKind } from "@/db/schema/agent";
import type { SubjectItem } from "@/domain/agent/queries";
import { relativeTime } from "@/lib/request-format";
import { DeskCard } from "@/components/admin/desk-ui";
import { DismissItemButton } from "./dismiss-item-button";

/**
 * "Assistant notes" on a request or trip page: what the daily assistant
 * published, flagged, drafted or noticed about this subject, one entry per
 * open item with a Dismiss link. Renders nothing when there is nothing.
 */

const KIND_WORDS: Record<RunItemKind, string> = {
  post: "Published",
  flag: "Flagged",
  draft: "Drafted",
  note: "Noted",
  insight: "Insight",
  proposal: "Proposed",
};

export function kindWord(kind: string): string {
  return KIND_WORDS[kind as RunItemKind] ?? "Noted";
}

const RUN_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Oct 2" from the run's YYYY-MM-DD (no timezone shift). */
function runDayWords(runDate: string): string {
  const d = new Date(`${runDate}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? runDate : RUN_DAY.format(d);
}

function Title({ title, url }: { title: string; url: string | null }) {
  const cls = "text-[15px] leading-[1.45] text-bone";
  if (!url) return <span className={cls}>{title}</span>;
  if (url.startsWith("/")) {
    return (
      <Link href={url} className={`${cls} text-link`}>
        {title}
      </Link>
    );
  }
  if (url.startsWith("https://")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={`${cls} text-link`}>
        {title}
      </a>
    );
  }
  return <span className={cls}>{title}</span>;
}

export function AssistantNotesCard({
  items,
  now,
  path,
  className = "",
}: {
  items: SubjectItem[];
  now: Date;
  /** The page to refresh after a dismiss, e.g. "/admin/requests/<id>". */
  path: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <DeskCard title="Assistant notes" className={className}>
      <ul className="mt-3 flex flex-col divide-y divide-line-faint">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill pill-outline h-5 px-2 text-[11px] text-bone-2">{kindWord(item.kind)}</span>
                <Title title={item.title} url={item.url} />
              </div>
              {item.bodyMd ? (
                <p className="mt-1.5 line-clamp-5 whitespace-pre-wrap break-words text-[14px] leading-[1.5] text-bone-2">{item.bodyMd}</p>
              ) : null}
              <div className="mt-1 text-[13px] text-steel">
                From the run on {runDayWords(item.runDate)} · {relativeTime(item.createdAt, now)}
              </div>
            </div>
            <DismissItemButton id={item.id} path={path} />
          </li>
        ))}
      </ul>
    </DeskCard>
  );
}
