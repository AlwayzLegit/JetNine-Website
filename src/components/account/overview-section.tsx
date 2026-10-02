import Link from "next/link";

/**
 * Section heading row on the account pages: 13px steel label on the left,
 * optional "All quotes →" link on the right.
 */
export function SectionHead({
  label,
  href,
  linkText,
  className = "",
}: {
  label: string;
  href?: string;
  linkText?: string;
  className?: string;
}) {
  return (
    <div className={["flex items-baseline justify-between gap-4", className].join(" ")}>
      <h2 className="label-jn text-[13px]">{label}</h2>
      {href && linkText ? (
        <Link href={href} className="text-[14px] text-bone-2 transition-colors hover:text-bone">
          {linkText}
        </Link>
      ) : null}
    </div>
  );
}
