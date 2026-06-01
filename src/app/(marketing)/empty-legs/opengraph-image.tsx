import { ImageResponse } from "next/og";
import { ogCardJsx, ogCardSize, ogCardContentType, siteBase } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "JetNine Empty legs — repositioning sectors at up to 60% off";
export const size = ogCardSize;
export const contentType = ogCardContentType;

export default function OgImage() {
  return new ImageResponse(
    ogCardJsx({
      kicker: "Empty legs",
      title: "Repositioning legs. Up to 60% off.",
      lead: "Live board, updated every fifteen minutes from operator dispatch. Watchlist alerts included.",
      bgImageUrl: `${siteBase()}/images/programs/reposition-sector.webp`,
    }),
    { ...size },
  );
}
