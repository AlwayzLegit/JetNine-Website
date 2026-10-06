// Bronze line icons from the light aircraft templates (jn-model-windows.js
// ICONS + the Aircraft page's own set). 24×24, 1.4 stroke, no fill.

export const ICONS = {
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6",
  seat: "M6 20V8l6-5 6 5v12M9 20v-6h6v6M4 20h16",
  chair: "M7 4v9h9l3 7M7 13l-3 7M7 4h4",
  people: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 5a3 3 0 0 1 0 6M19 20a6 6 0 0 0-3-5",
  plane: "M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3",
  bag: "M5 8h14v12H5zM9 8V5h6v3M5 13h14",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  door: "M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16M14 12h.01",
  cup: "M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM16 9h2a2 2 0 0 1 0 4h-2M6 21h8",
  wind: "M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7a2 2 0 1 1-2 2",
  fuel: "M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M5 21h10M7 7h6v4H7zM15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3",
  warn: "M12 3l10 18H2zM12 10v4M12 17h.01",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4",
  shield: "M12 3l8 4v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7l8-4z",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  book: "M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 5v16M8 7h8M8 11h8",
  scale: "M12 3v18M4 7h16M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0zM8 21h8",
  coins: "M12 9c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  calendar: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
  pin: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  table: "M3 9h18M5 9v11M19 9v11M8 9V6h8v3",
  runway: "M8 21l3-18h2l3 18M6 21h12M11 8h2M10.5 13h3M10 18h4",
} as const;

export type IconName = keyof typeof ICONS;

export function LineIcon({
  name,
  size = 24,
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
      className={`flex-none ${className}`}
      style={{ width: size, height: size }}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
