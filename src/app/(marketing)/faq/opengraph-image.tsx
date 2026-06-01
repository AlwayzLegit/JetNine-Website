import { ImageResponse } from "next/og";
import { ogCardJsx, ogCardSize, ogCardContentType, siteBase } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "JetNine FAQ — questions before the call";
export const size = ogCardSize;
export const contentType = ogCardContentType;

export default function OgImage() {
  return new ImageResponse(
    ogCardJsx({
      kicker: "JetNine FAQ",
      title: "The questions before the call.",
      lead: "Forty-two answers, written by the dispatch desk, for the questions that come in at 11pm on a Sunday.",
      bgImageUrl: `${siteBase()}/images/fleet/midsize.webp`,
    }),
    { ...size },
  );
}
