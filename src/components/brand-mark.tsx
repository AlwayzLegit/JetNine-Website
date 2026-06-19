import Image from "next/image";
import Link from "next/link";

type Size = "sm" | "md" | "lg";

// Rendered heights (px). Width follows the wordmark's intrinsic aspect
// (~3.8:1) via `width:auto`, so these never distort. The bone wordmark is
// a transparent webp keyed from logo-dark.png — it sits seamlessly on any
// of the app's dark (ink) surfaces, which is everywhere BrandMark renders
// (site nav, footer, admin shell, quote nav).
const heightPx: Record<Size, number> = {
  sm: 18,
  md: 22,
  lg: 28,
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
  const h = heightPx[size];
  return (
    <Link
      href={href}
      className={`inline-flex items-center ${className}`}
      aria-label="JetNine — Home"
    >
      <Image
        src="/images/brand/wordmark-bone.webp"
        alt=""
        width={900}
        height={237}
        priority
        sizes="120px"
        style={{ height: `${h}px`, width: "auto" }}
      />
    </Link>
  );
}
