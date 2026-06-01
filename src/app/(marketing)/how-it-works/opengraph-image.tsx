import { ImageResponse } from "next/og";
import { ogCardJsx, ogCardSize, ogCardContentType, siteBase } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "How JetNine works — quote to wheels-up in under 30 minutes";
export const size = ogCardSize;
export const contentType = ogCardContentType;

export default function OgImage() {
  return new ImageResponse(
    ogCardJsx({
      kicker: "How it works",
      title: "Quote to wheels-up in under thirty minutes.",
      lead: "Senior dispatcher, not a chatbot. One number to call. Specific airframes and pricing back, fast.",
      bgImageUrl: `${siteBase()}/images/programs/tarmac-dusk.webp`,
    }),
    { ...size },
  );
}
