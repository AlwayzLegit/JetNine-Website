import Link from "next/link";

/**
 * Review section: numbered serif title on the left, underlined "Edit" link
 * on the right that jumps back to the step, 1px line underneath.
 */
export function ReviewSection({
  title,
  editHref,
  editLabel,
  children,
}: {
  title: string;
  editHref: string;
  /** Accessible name for the Edit link, e.g. "Edit mission". */
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-2">
        <h2 className="font-serif text-[22px] leading-[1.2] text-bone">{title}</h2>
        <Link
          href={editHref}
          aria-label={editLabel}
          className="-my-2 inline-flex min-h-11 items-center text-[14px] font-semibold text-bone underline underline-offset-[3px] hover:text-gold"
        >
          Edit
        </Link>
      </header>
      {children}
    </section>
  );
}
