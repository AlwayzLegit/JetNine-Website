import Image from "next/image";
import Link from "next/link";

type Size = "sm" | "md" | "lg";

// Rendered heights (px). Width follows the wordmark's intrinsic aspect
// (~1.53:1 — the full mark, including the low-opacity "9" overlay) via
// `width:auto`, so these never distort. The bone wordmark is a transparent
// webp keyed from logo-dark.png — it sits seamlessly on any of the app's
// dark (ink) surfaces, which is everywhere BrandMark renders (site nav,
// footer, admin shell, quote nav). The taller heights vs a plain wordmark
// give the ghost 9 room to read.
const heightPx: Record<Size, number> = {
  sm: 40,
  md: 52,
  lg: 64,
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
        width={1000}
        height={652}
        priority
        sizes="160px"
        style={{ height: `${h}px`, width: "auto" }}
      />
    </Link>
  );
}
