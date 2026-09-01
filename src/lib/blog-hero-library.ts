// Pre-generated hero images for posts that arrive without one (the daily
// routine runs without image-generation tools when HF_TOKEN is unset).
// Each entry lists the topic clusters it suits so a caller can pick by
// subject rather than by eye. Files live in public/images/blog/library/.

export type HeroLibraryEntry = {
  file: string;
  url: string;
  alt: string;
  clusters: string[];
};

const RAW: Omit<HeroLibraryEntry, "url">[] = [
  {
    file: "cabin-interior",
    alt: "Cream leather club seats and a walnut table inside a heavy private jet cabin in evening light",
    clusters: ["aircraft", "heavy", "cabin", "memberships", "jet card", "comfort"],
  },
  {
    file: "desert-city-approach",
    alt: "Private jet on final approach over a glittering desert city at dusk",
    clusters: ["routes", "las vegas", "scottsdale", "palm springs", "cities", "weekend"],
  },
  {
    file: "city-night-window",
    alt: "Dense city skyline at night seen from a private jet window",
    clusters: ["cities", "new york", "chicago", "business travel", "routes"],
  },
  {
    file: "fbo-lounge",
    alt: "Modern FBO lounge with a business jet waiting on the ramp beyond the glass",
    clusters: ["how it works", "airports", "first booking", "fbo", "ground experience"],
  },
  {
    file: "winter-ramp",
    alt: "Midsize private jet on a snow-dusted ramp in falling snow with a de-icing truck nearby",
    clusters: ["seasonal", "winter", "pricing", "safety", "weather", "holidays"],
  },
  {
    file: "turboprop-mountains",
    alt: "Turboprop aircraft on a mountain airstrip surrounded by snow-covered peaks",
    clusters: ["turboprop", "aspen", "ski", "seasonal", "routes", "mountain airports"],
  },
  {
    file: "ramp-arrival",
    alt: "Black sedan and leather luggage beside the open airstair of a private jet at golden hour",
    clusters: ["first booking", "how it works", "memberships", "arrival", "ground transport"],
  },
];

export const HERO_LIBRARY: HeroLibraryEntry[] = RAW.map((e) => ({
  ...e,
  url: `/images/blog/library/${e.file}.webp`,
}));
