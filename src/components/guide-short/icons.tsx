/**
 * Line icons from the light guide templates (Light - Guide 14 / Light -
 * Guides): 24px viewBox, bronze 1.4 stroke, round caps.
 */
export const GUIDE_ICON_PATHS = {
  people: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1",
  bag: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16v13H4zM9 11v5M15 11v5",
  plane: "M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3",
  seat: "M7 4v9h9l2 7M7 13l-2 7M7 7h6",
  route: "M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h7a4 4 0 0 0 0-8h-2",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  calc: "M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
  pin: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  warn: "M12 3l10 18H2L12 3zM12 10v4M12 17h.01",
  calendar: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
  passport: "M6 3h12v18H6zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 16h6",
  door: "M5 3h14v18H5zM15 12h.01M9 21v-3",
  scale: "M12 3v18M4 7h16M6 7l-3 7a3 3 0 0 0 6 0L6 7zM18 7l-3 7a3 3 0 0 0 6 0l-3-7",
  fuel: "M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M5 21h10M7 7h6v4H7zM15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3",
  wind: "M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8a2 2 0 1 1-2 2",
  paw: "M12 21c-3 0-6-2-6-5s3-4 6-4 6 1 6 4-3 5-6 5zM6 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14.5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  wifi: "M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 19.5h.01",
  cup: "M5 8h12v5a6 6 0 0 1-12 0zM17 9h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2M12 3v2",
  tag: "M3 12V3h9l9 9-9 9-9-9zM8 8h.01",
  wheel: "M10 19a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM10 7V3h3M10 13h8l2 6",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  shield: "M12 3l8 4v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7l8-4z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  calcAlt: "M6 3h12v18H6zM9 7h6M9 12h2M13 12h2M9 16h2M13 16h2",
} as const;

export type GuideIconName = keyof typeof GUIDE_ICON_PATHS;

export function GIcon({
  name,
  size = 24,
  className = "",
  strokeWidth = 1.4,
}: {
  name: GuideIconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--gold)"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
      style={{ width: size, height: size }}
    >
      <path d={GUIDE_ICON_PATHS[name]} />
    </svg>
  );
}

/** The circled "i" used in the takeaway and notice strips. */
export function InfoIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.6" aria-hidden="true" className={`h-[18px] w-[18px] flex-none ${className}`}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}
