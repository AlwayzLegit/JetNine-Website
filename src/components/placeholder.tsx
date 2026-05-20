type AspectRatio = "1/1" | "4/5" | "16/9" | "16/10" | "3/4";

const aspectClass: Record<AspectRatio, string> = {
  "1/1": "aspect-square",
  "4/5": "aspect-[4/5]",
  "16/9": "aspect-video",
  "16/10": "aspect-[16/10]",
  "3/4": "aspect-[3/4]",
};

export function Placeholder({
  caption,
  glyph = "9",
  aspect = "16/10",
  className = "",
}: {
  caption?: string;
  glyph?: string;
  aspect?: AspectRatio;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden bg-gradient-to-br from-ink-3 to-[#0A0C10]",
        aspectClass[aspect],
        className,
      ].join(" ")}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.014) 0, rgba(255,255,255,0.014) 1px, transparent 1px, transparent 14px)",
        }}
      />
      {caption ? (
        <span className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.16em] text-steel">
          {caption}
        </span>
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center font-serif font-light text-[22vw] leading-none text-[rgba(232,226,210,0.07)]"
        style={{ fontVariationSettings: '"opsz" 144' }}
      >
        {glyph}
      </span>
    </div>
  );
}
