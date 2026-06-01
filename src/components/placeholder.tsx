import Image from "next/image";

type AspectRatio = "1/1" | "4/5" | "16/9" | "16/10" | "3/4";

const aspectClass: Record<AspectRatio, string> = {
  "1/1": "aspect-square",
  "4/5": "aspect-[4/5]",
  "16/9": "aspect-video",
  "16/10": "aspect-[16/10]",
  "3/4": "aspect-[3/4]",
};

/**
 * Editorial visual block. Renders either:
 *   - a real image (when `imageUrl` is provided), or
 *   - a stylized CSS placeholder with gradient + giant numeral glyph
 *
 * The placeholder backdrop renders in both cases so a missing/404 image
 * degrades gracefully — the image overlays the placeholder rather than
 * replacing it. This keeps the layout intact while marketing photography
 * is being staged into /public/images.
 */
export function Placeholder({
  caption,
  glyph = "9",
  aspect = "16/10",
  className = "",
  imageUrl,
  imageAlt,
  priority = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw",
}: {
  caption?: string;
  glyph?: string;
  aspect?: AspectRatio;
  className?: string;
  /** Path under /public (e.g. `/images/fleet/light.webp`) or any next/image-supported URL. */
  imageUrl?: string;
  /** Defaults to `caption` (stripped of leading dash) if not provided. */
  imageAlt?: string;
  /** Pass `true` for the LCP-eligible block(s) above the fold. */
  priority?: boolean;
  /** Responsive sizes hint for next/image. Override per-instance for tighter layouts. */
  sizes?: string;
}) {
  const altText = (imageAlt ?? caption ?? "").replace(/^—\s*/, "");

  return (
    <div
      className={[
        "relative overflow-hidden bg-gradient-to-br from-ink-3 to-[#0A0C10]",
        aspectClass[aspect],
        className,
      ].join(" ")}
    >
      {/* Always-rendered placeholder scanlines — visible if imageUrl is
          missing OR if the image 404s in the browser. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.014) 0, rgba(255,255,255,0.014) 1px, transparent 1px, transparent 14px)",
        }}
      />

      {/* Giant background glyph only when no image — would be visual noise
          on top of a real photo. */}
      {!imageUrl ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center font-serif font-light text-[22vw] leading-none text-[rgba(232,226,210,0.07)]"
          style={{ fontVariationSettings: '"opsz" 144' }}
        >
          {glyph}
        </span>
      ) : null}

      {/* The actual photograph. next/image handles lazy-loading + AVIF/WebP
          serving. `fill` makes it cover the parent without a wrapper. */}
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={altText}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      ) : null}

      {/* Caption — small mono uppercase, top-left. When an image is shown
          we add a subtle dark gradient under the caption for legibility. */}
      {caption ? (
        <>
          {imageUrl ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-ink/60 to-transparent"
            />
          ) : null}
          <span className="absolute left-4 top-4 z-10 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-2">
            {caption}
          </span>
        </>
      ) : null}
    </div>
  );
}
