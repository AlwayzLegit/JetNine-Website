// Line icons from the light company prototypes (24px grid, 1.4 stroke,
// bronze by default). Paths are copied from the .dc.html sources so the
// pages draw the same glyphs.

export const ICON_PATHS = {
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  pin: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  plane: "M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  shield: "M12 3l8 4v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7l8-4z",
  seat: "M6 20V8l6-5 6 5v12M9 20v-6h6v6M4 20h16",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  crew: "M4 11c0-1.5 3.6-3 8-3s8 1.5 8 3M4 11v2c0 1.5 3.6 3 8 3s8-1.5 8-3v-2M6 8V6a6 6 0 0 1 12 0v2",
  calendar: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({
  name,
  className = "h-6 w-6",
  stroke = "var(--gold)",
  strokeWidth = 1.4,
}: {
  name: IconName;
  className?: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** Filled bronze check disc used in the prototypes' lists. */
export function CheckDot({ size = 17, outline = false }: { size?: number; outline?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={[
        "flex flex-none items-center justify-center rounded-full font-sans text-[12px] font-bold leading-none",
        outline ? "border border-gold text-gold" : "bg-gold text-white",
      ].join(" ")}
    >
      ✓
    </span>
  );
}

/** Round sand disc holding an icon or a short mark ("JN", initials). */
export function Disc({
  size = 56,
  className = "",
  children,
}: {
  size?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`flex flex-none items-center justify-center rounded-full bg-surface-2 font-serif text-gold ${className}`}
    >
      {children}
    </span>
  );
}
