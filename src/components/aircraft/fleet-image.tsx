import Image from "next/image";

type Props = {
  /** Path under /public. When absent the frame renders as a plain surface. */
  src?: string;
  alt?: string;
  aspect?: "16/9" | "16/10" | "4/5";
  sizes?: string;
  priority?: boolean;
  className?: string;
};

const ASPECT: Record<NonNullable<Props["aspect"]>, string> = {
  "16/9": "aspect-[16/9]",
  "16/10": "aspect-[16/10]",
  "4/5": "aspect-[4/5]",
};

/**
 * Fleet photo in a fixed-ratio frame on surface-2 — the image treatment
 * of the simplification's aircraft cards (12px radius comes from the
 * parent card, or pass `rounded-card` in className for a standalone).
 */
export function FleetImage({
  src,
  alt = "",
  aspect = "16/9",
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority,
  className = "",
}: Props) {
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${ASPECT[aspect]} ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
      ) : null}
    </div>
  );
}
