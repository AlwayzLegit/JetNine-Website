import type { BestForTile } from "@/lib/fleet";

type IconKey = BestForTile["iconKey"];

const ICONS: Record<IconKey, React.ReactNode> = {
  boltsmall: (
    <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7Z" />
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  users: (
    <>
      <path d="M16 19v-1.5A2.5 2.5 0 0013.5 15h-3A2.5 2.5 0 008 17.5V19" />
      <circle cx="12" cy="9" r="3" />
      <path d="M20 19v-1.5a2.5 2.5 0 00-1.6-2.34" />
      <path d="M18.5 6.5a3 3 0 010 5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 4 6 4 8.5s-1.5 5.9-4 8.5c-2.5-2.6-4-6-4-8.5s1.5-5.9 4-8.5Z" />
    </>
  ),
  shield: (
    <path d="M12 3l8 4v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7l8-4Z" />
  ),
  moon: <path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5Z" />,
  table: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path d="M3.5 11h17M12 5.5v13" />
    </>
  ),
};

export function BestForIcon({ name }: { name: IconKey }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}
