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
 * One row in the Messages list: 34px serif initial circle, name (600 when
 * unread), context and preview truncated, time on the right, gold dot for
 * unread. Rows are links so the selection lives in the URL.
 */
export function ThreadRow({ href, selected, initial, name, context, preview, when, unread = false, tone = "default", tag }: ThreadRowProps) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={[
        "grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-2.5 border-b border-line px-3.5 py-3 text-left text-[14px] transition-colors",
        selected ? "bg-surface-2" : "hover:bg-surface-2/40",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={`flex h-[34px] w-[34px] items-center justify-center rounded-full font-serif text-[15px] ${
          tone === "danger" ? "bg-[rgba(156,33,33,0.08)] text-danger" : "bg-[#ECE3D6] text-gold"
        }`}
      >
        {initial}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className={`truncate text-bone ${unread ? "font-bold" : "font-normal"}`}>{name}</span>
          {unread ? <span className="dot dot-gold" aria-label="Unread" /> : null}
          {tag ? <span className="pill pill-outline h-5 flex-none px-2 text-[11px] text-bone-2">{tag}</span> : null}
        </span>
        {context ? <span className="block truncate text-[12px] text-steel">{context}</span> : null}
        {preview ? (
          <span className={`block truncate text-[12px] ${tone === "danger" ? "text-danger" : unread ? "text-bone" : "text-steel"}`}>
            {preview}
          </span>
        ) : null}
      </span>
      <span className="whitespace-nowrap pt-0.5 text-[12px] text-steel">{when}</span>
    </Link>
  );
}
