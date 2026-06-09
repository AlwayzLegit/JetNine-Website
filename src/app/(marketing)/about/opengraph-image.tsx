import { ImageResponse } from "next/og";
import { ogCardJsx, ogCardSize, ogCardContentType, siteBase } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "About JetNine — A small company built on the old idea of one phone number";
export const size = ogCardSize;
export const contentType = ogCardContentType;

export default function OgImage() {
  return new ImageResponse(
    ogCardJsx({
      kicker: "About JetNine",
      title: "A small company built on one phone number.",
      lead: "Senior-dispatcher charter brokerage in Los Angeles. One number, one desk, ready when you are.",
      bgImageUrl: `${siteBase()}/images/about/dispatch-room.webp`,
    }),
    { ...size },
  );
}
