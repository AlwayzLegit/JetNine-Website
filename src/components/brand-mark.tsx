import Link from "next/link";

type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "text-[18px]",
  md: "text-[22px]",
  lg: "text-[26px]",
};

const badgeClasses: Record<Size, string> = {
  sm: "text-[9px] px-1 py-0.5",
  md: "text-[11px] px-1.5 py-[3px]",
  lg: "text-[12px] px-2 py-[3px]",
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
      className={`inline-flex items-baseline gap-1.5 font-serif font-normal leading-none tracking-tight text-bone ${sizeClasses[size]} ${className}`}
      aria-label="JetNine — Home"
    >
      JetNine
      <span
        className={`font-mono tracking-[0.12em] text-clearance border border-ink-4 rounded-[2px] ${badgeClasses[size]}`}
      >
        09
      </span>
    </Link>
  );
}
