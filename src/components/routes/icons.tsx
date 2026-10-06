export const SOURCE_URLS = {
  faa: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft",
  cbp: "https://www.cbp.gov/travel/pleasure-boats-private-flyers",
  state: "https://travel.state.gov/content/travel/en/international-travel.html",
  vny: "https://www.iflyvny.com/",
  teb: "https://www.panynj.gov/airports/en/teterboro.html",
};

export const ICONS = {
  city: "M4 21V9l6-4 6 4v12M4 21h16M10 21v-5h4v5M7 12h2M7 16h2M15 12h2M15 16h2",
  plane: "M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3",
  calendar: "M3 6h18v15H3zM3 10h18M8 3v4M16 3v4",
  people: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 5a3 3 0 0 1 0 6M19 20a6 6 0 0 0-3-5",
  pin: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  shield: "M12 3l8 4v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V7l8-4z",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
  bag: "M6 8h12l-1 13H7L6 8zM9 8V6a3 3 0 0 1 6 0v2",
  cloud: "M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9H7z",
  swap: "M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l3-3M17 20l-3-3",
  plus: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v8M8 12h8",
};

export function Icon({ d, className = "h-[22px] w-[22px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={d} />
    </svg>
  );
}
