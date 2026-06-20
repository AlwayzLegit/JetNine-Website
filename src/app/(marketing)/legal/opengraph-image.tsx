import { ImageResponse } from "next/og";
import { ogCardJsx, ogCardSize, ogCardContentType } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "JetNine — Legal, terms & privacy";
export const size = ogCardSize;
export const contentType = ogCardContentType;

export default function OgImage() {
  return new ImageResponse(
    ogCardJsx({
      kicker: "Legal",
      title: "Terms, privacy & policies.",
      lead: "JetNine LLC — 14 CFR Part 295 indirect air carrier. All flights operated by FAA Part 135 certificated direct air carriers.",
      bottomLeft: "jetnine.com/legal",
    }),
    { ...size },
  );
}
