import { ImageResponse } from "next/og";
import { ogCardJsx, ogCardSize, ogCardContentType, siteBase } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "JetNine Memberships — Three ways to fly, none of them require a membership";
export const size = ogCardSize;
export const contentType = ogCardContentType;

export default function OgImage() {
  return new ImageResponse(
    ogCardJsx({
      kicker: "Memberships",
      title: "Three ways to fly.",
      lead: "On-demand, JetNine Card, or Reserve. Locked rates, refundable deposits, no peak surcharges.",
      bgImageUrl: `${siteBase()}/images/programs/black-card.webp`,
    }),
    { ...size },
  );
}
