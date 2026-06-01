import { ImageResponse } from "next/og";
import { ogCardJsx, ogCardSize, ogCardContentType, siteBase } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "JetNine Aircraft — six categories, hundreds of airframes";
export const size = ogCardSize;
export const contentType = ogCardContentType;

export default function OgImage() {
  return new ImageResponse(
    ogCardJsx({
      kicker: "Aircraft",
      title: "Six categories. Hundreds of airframes.",
      lead: "Turboprop through ultra long range — match the airframe to the mission, not the other way around.",
      bgImageUrl: `${siteBase()}/images/fleet/ultra.webp`,
    }),
    { ...size },
  );
}
