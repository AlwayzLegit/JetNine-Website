import { ImageResponse } from "next/og";
import { getFleetEntry } from "@/lib/fleet";
import { notFound } from "next/navigation";
import { ogCardJsx, ogCardSize, ogCardContentType, siteBase } from "@/lib/og-card";

// Per-category OG card in the shared light-system composition: the
// category photo under the navy scrim, the category title, the lead and
// the passengers / range / speed triple. generateImageMetadata declares
// one card per fleet slug so each is generated at build time.
//
// The background is a 1200×630 JPEG crop of the fleet photo
// (public/images/og/fleet-<slug>.jpg) — Satori cannot decode WebP.

export const runtime = "edge";
export const size = ogCardSize;
export const contentType = ogCardContentType;
export const alt = "JetNine aircraft category";

type RouteParams = { params: Promise<{ category: string }> };

/** Trim to `max` characters at a word boundary, with an ellipsis. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "")}…`;
}

// One card per page: return only this category's entry. Returning every
// fleet slug made each category page list six og:image tags with
// turboprop first, so every category shared as the turboprop card.
export async function generateImageMetadata({ params }: { params: { category: string } }) {
  const f = getFleetEntry(params.category);
  if (!f) return [];
  return [
    {
      id: f.slug,
      alt: f.shortName && f.shortName !== f.name ? `JetNine ${f.name} — ${f.shortName}` : `JetNine ${f.name} private jets`,
      size,
      contentType,
    },
  ];
}

export default async function CategoryOgImage({ params }: RouteParams) {
  const { category } = await params;
  const entry = getFleetEntry(category);
  if (!entry) notFound();

  return new ImageResponse(
    ogCardJsx({
      kicker: `JetNine · ${entry.kicker.replace(/^.+? · /, "")}`,
      title: entry.title,
      lead: clip(entry.lead, 140),
      bgImageUrl: `${siteBase()}/images/og/fleet-${entry.slug}.jpg`,
      bottomLeft: `${entry.pax} passengers · ${entry.rangeNm.toLocaleString()} nm · ${entry.speedKt} kt`,
    }),
    { ...size },
  );
}
