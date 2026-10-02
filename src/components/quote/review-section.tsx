import Link from "next/link";

/**
 * Review section: numbered title on the left, underlined "Edit" link on
 * the right that jumps back to the step, 1px line underneath.
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
    <section className="mt-8">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-3">
        <h2 className="title-card-sm">{title}</h2>
        <Link
          href={editHref}
          aria-label={editLabel}
          className="text-link -my-2 inline-flex min-h-11 items-center text-[15px]"
        >
          Edit
        </Link>
      </header>
      {children}
    </section>
  );
}
