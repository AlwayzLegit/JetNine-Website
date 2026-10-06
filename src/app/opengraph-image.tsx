import { ImageResponse } from "next/og";
import { ogCardJsx, ogCardSize, ogCardContentType, siteBase } from "@/lib/og-card";

// Default OG card served for every route that doesn't provide its own:
// the Home hero line over the hero photo, in the shared light-system card.

export const runtime = "edge";
export const alt = "JetNine — Private jet charter. Your journey, on your terms.";
export const size = ogCardSize;
export const contentType = ogCardContentType;

export default function OpengraphImage() {
  return new ImageResponse(
    ogCardJsx({
      kicker: "Private jet charter, considered.",
      title: "Your journey. On your terms.",
      lead: "The right aircraft. A clear quote. A journey shaped around you.",
      bgImageUrl: `${siteBase()}/images/light/og-hero.jpg`,
      bottomLeft: "+1 (424) 487-2707",
    }),
    { ...size },
  );
}
