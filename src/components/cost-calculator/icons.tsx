// Line icons from the light handoff (jn-pack-windows.js `I`), 24×24 paths
// drawn at 1.4px in bronze by default.
export const ICONS = {
  plane: "M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3",
  pin: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  calendar: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6",
  people: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 5a3 3 0 0 1 0 6M19 20a6 6 0 0 0-3-5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  shield: "M12 3l8 4v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7l8-4z",
  book: "M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 5v16M8 7h8M8 11h8",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
  cloud: "M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4",
  route: "M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 16c0-6 12-4 12-8",
  swap: "M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l3-3M17 20l-3-3",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  dollar:
    "M12 2v20M17 6.5a4.5 4.5 0 0 0-4.5-2.5h-1A3.5 3.5 0 0 0 8 7.5c0 2 1.5 3 3.5 3.5h1c2 .5 3.5 1.5 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5h-1A4.5 4.5 0 0 1 7 15.5",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  className = "",
  stroke = "var(--gold)",
}: {
  name: IconName;
  size?: number;
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
