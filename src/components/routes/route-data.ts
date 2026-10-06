import { FLEET, type AircraftCategorySlug } from "@/lib/fleet";
import { MODELS } from "@/lib/models";
import { distanceNm } from "@/lib/airports";
import {
  computeIndicative,
  formatHours,
  formatUSD,
  recommendCategory,
  type Indicative,
} from "@/lib/quote-pricing";
import type { CharterRoute } from "@/lib/routes";

export type CategoryOption = {
  slug: AircraftCategorySlug;
  name: string;
  href: string;
  ind: Indicative;
  hours: string;
  recommended: boolean;
  exampleModels: string[];
};

const nmFormat = new Intl.NumberFormat("en-US");
export const formatNm = (n: number) => `${nmFormat.format(n)} nm`;

// Every category whose published range covers the leg, priced by the
// engine — cheapest first. The recommendation mirrors the wizard's own
// recommendCategory() so the two never disagree.
export function categoryOptions(route: CharterRoute): { nm: number; options: CategoryOption[] } {
  const nm = distanceNm(route.from, route.to);
  const rec = recommendCategory(4, nm);
  const options = FLEET.filter((f) => f.rangeNm >= nm)
    .map((f) => {
      const ind = computeIndicative({
        category: f.slug,
        legs: [{ id: "r", fromIata: route.from.iata, toIata: route.to.iata, distanceNm: nm }],
      });
      if (!ind) return null;
      return {
        slug: f.slug,
        name: f.name,
        href: f.href,
        ind,
        hours: formatHours(ind.hours),
        recommended: f.slug === rec,
        exampleModels: MODELS.filter((m) => m.category === f.slug)
          .slice(0, 2)
          .map((m) => m.shortName),
      };
    })
    .filter((o): o is CategoryOption => o !== null)
    .sort((a, b) => a.ind.low - b.ind.low)
    .slice(0, 4);
  return { nm, options };
}

/** U.S. airports carry a K-prefixed ICAO code; everything else is international. */
export const isInternational = (r: CharterRoute) =>
  !r.from.icao.startsWith("K") || !r.to.icao.startsWith("K");

const CITY_IMG: Record<string, string> = {
  "New York": "new-york",
  "Las Vegas": "las-vegas",
  Miami: "miami",
  Aspen: "aspen",
  London: "london",
  "San Francisco": "san-francisco",
  "Los Angeles": "los-angeles",
  "Los Cabos": "coastal-destination",
  Nassau: "coastal-destination",
  "Palm Beach": "coastal-destination",
  "Martha's Vineyard": "coastal-destination",
  Jacksonville: "coastal-destination",
  "Jackson Hole": "mountain-landscape",
  Scottsdale: "mountain-landscape",
};

/** Destination photo for a lane (illustrative), falling back to an in-flight shot. */
export function routeImage(r: CharterRoute): string {
  const name = CITY_IMG[r.to.city] ?? "jet-ultra-flight";
  return `/images/light/${name}.webp`;
}

/** Serializable card data for the hub explorer and related-lane cards. */
export type RouteCard = {
  slug: string;
  from: string;
  to: string;
  fromIata: string;
  toIata: string;
  fromName: string;
  toName: string;
  intl: boolean;
  img: string;
  summary: string;
  note: string;
  distance: string;
  hours: string;
  fromPrice: string;
};

export function routeCard(r: CharterRoute): RouteCard {
  const { nm, options } = categoryOptions(r);
  const cheapest = options[0];
  const fastest = options.reduce<CategoryOption | undefined>(
    (a, b) => (!a || b.ind.hours < a.ind.hours ? b : a),
    undefined,
  );
  const first = r.note.match(/^.+?[.!?](\s|$)/)?.[0].trim() ?? r.note;
  return {
    slug: r.slug,
    from: r.from.city,
    to: r.to.city,
    fromIata: r.from.iata,
    toIata: r.to.iata,
    fromName: r.from.name,
    toName: r.to.name,
    intl: isInternational(r),
    img: routeImage(r),
    summary: first,
    note: r.note,
    distance: formatNm(nm),
    hours: fastest?.hours ?? "",
    fromPrice: cheapest ? formatUSD(cheapest.ind.low) : "",
  };
}

