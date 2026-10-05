// Line icons from Light - FAQ.dc.html (24px viewBox, bronze 1.4 stroke).
export const FAQ_ICON = {
  question: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14M12 17h.01",
  calendar: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
  card: "M3 6.5h18v12H3zM3 10.5h18M7 15h4",
  plane: "M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3",
  bag: "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  shield: "M12 3l8 4v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7l8-4z",
  people: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 5a3 3 0 0 1 0 6M19 20a6 6 0 0 0-3-5",
  calc: "M6 3h12v18H6zM9 7h6M9 11h2M13 11h2M9 15h2M13 15h2",
  pin: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  bank: "M3 10l9-6 9 6H3zM5 10v8M9 10v8M15 10v8M19 10v8M3 18h18v3H3z",
  paw: "M12 21c-3 0-6-2-6-5 0-2 2-3 3-4l3-3 3 3c1 1 3 2 3 4 0 3-3 5-6 5zM6 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  copy: "M9 9h10v12H9zM5 15H4V3h10v1",
} as const;

export type FaqIconName = keyof typeof FAQ_ICON;

export function FaqIcon({
  name,
  className = "h-5 w-5",
  stroke = "var(--gold)",
  strokeWidth = 1.4,
}: {
  name: FaqIconName;
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
      <path d={FAQ_ICON[name]} />
    </svg>
  );
}

/** The 48px sand disc with a bronze icon used on the FAQ cards. */
export function IconDisc({ name, size = 48 }: { name: FaqIconName; size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full bg-[#F3EDE3]"
      style={{ width: size, height: size }}
    >
      <FaqIcon name={name} className={size > 50 ? "h-6 w-6" : "h-[22px] w-[22px]"} />
    </span>
  );
}
