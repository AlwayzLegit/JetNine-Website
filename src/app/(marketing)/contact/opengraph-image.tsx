import { ImageResponse } from "next/og";
import { ogCardJsx, ogCardSize, ogCardContentType, siteBase } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "JetNine Contact — One desk, one number, always";
export const size = ogCardSize;
export const contentType = ogCardContentType;

export default function OgImage() {
  return new ImageResponse(
    ogCardJsx({
      kicker: "Contact dispatch",
      title: "One desk. One number. Always.",
      lead: "Senior dispatcher picks up — average pick-up under twenty seconds. Open every hour of every day.",
      bgImageUrl: `${siteBase()}/images/about/dispatch-room.webp`,
      bottomLeft: "+1 (818) 900-5278",
    }),
    { ...size },
  );
}
