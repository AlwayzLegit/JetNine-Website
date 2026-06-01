import { ImageResponse } from "next/og";
import { ogCardJsx, ogCardSize, ogCardContentType, siteBase } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "JetNine Safety — ARG/US Platinum, Wyvern, IS-BAO Stage 2";
export const size = ogCardSize;
export const contentType = ogCardContentType;

export default function OgImage() {
  return new ImageResponse(
    ogCardJsx({
      kicker: "Safety",
      title: "The floor is high. The ceiling is mandatory.",
      lead: "Every operator audited every twelve months, with spot-checks in between. ARG/US Platinum, Wyvern, IS-BAO Stage 2.",
      bgImageUrl: `${siteBase()}/images/fleet/heavy.webp`,
    }),
    { ...size },
  );
}
