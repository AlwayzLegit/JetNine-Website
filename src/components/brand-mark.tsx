import Link from "next/link";

type Size = "sm" | "md" | "lg";

// The light design system's wordmark: "JETNINE" set in the serif with
// wide tracking, in ink. Text rather than an image, so it stays sharp and
// takes `currentColor` (white on the navy bands, ink everywhere else).
// sm is the mobile header, md the desktop header, lg the footer.
const fontPx: Record<Size, number> = {
  sm: 18,
  md: 23,
  lg: 26,
};

export function BrandMark({
  size = "md",
  href = "/",
  className = "",
}: {
  size?: Size;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center whitespace-nowrap font-serif leading-none tracking-[0.27em] text-bone transition-colors hover:text-bone ${className}`}
      style={{ fontSize: `${fontPx[size]}px` }}
      aria-label="JetNine — Home"
    >
      <span aria-hidden="true">JETNINE</span>
    </Link>
  );
}
