import Link from "next/link";

export type ThreadRowProps = {
  href: string;
  selected: boolean;
  /** "D", or "☎" for call-only threads, "!" for problems. */
  initial: string;
  name: string;
  /** "Los Angeles → Aspen · Oct 3–5" */
  context: string | null;
  /** Last line, "You: …" when the desk spoke last. */
  preview: string | null;
  /** "10 min ago" */
  when: string;
  unread?: boolean;
  tone?: "default" | "danger";
  /** Small outlined word after the name ("Client", "Money") for proposals. */
  tag?: string;
};

/**
 * One row in the Messages list: 40px initial circle, name (600 when
 * unread), context and preview truncated, time on the right, gold dot for
 * unread. Rows are links so the selection lives in the URL.
 */
export function ThreadRow({ href, selected, initial, name, context, preview, when, unread = false, tone = "default", tag }: ThreadRowProps) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={[
        "grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-3 rounded-[10px] px-3 py-3.5 text-left transition-colors",
        selected ? "bg-surface-2" : "hover:bg-surface-2/50",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-semibold ${
          tone === "danger" ? "bg-[rgba(224,122,107,0.12)] text-danger" : "bg-surface-2 text-clearance"
        }`}
      >
        {initial}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className={`truncate text-[16px] ${unread ? "font-semibold text-bone" : "font-medium text-bone"}`}>{name}</span>
          {unread ? <span className="dot dot-gold" aria-label="Unread" /> : null}
          {tag ? <span className="pill pill-outline h-5 flex-none px-2 text-[11px] text-bone-2">{tag}</span> : null}
        </span>
        {context ? <span className="block truncate text-[14px] text-steel">{context}</span> : null}
        {preview ? (
          <span className={`mt-0.5 block truncate text-[14px] ${tone === "danger" ? "text-danger" : unread ? "text-bone" : "text-steel"}`}>
            {preview}
          </span>
        ) : null}
      </span>
      <span className="whitespace-nowrap pt-0.5 text-[13px] text-steel">{when}</span>
    </Link>
  );
}
