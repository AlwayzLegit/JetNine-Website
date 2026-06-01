import { ImageResponse } from "next/og";
import { getFleetEntry } from "@/lib/fleet";
import { notFound } from "next/navigation";

// Per-category dynamic OG card. When someone shares /aircraft/light or
// /aircraft/ultra on Twitter, LinkedIn, Slack, etc., the link preview
// renders this composition instead of the raw 4:5 fleet photo. The
// dynamic card lays the photo behind a dark gradient + the category
// name in display serif + the headline spec triple (pax / range /
// speed) + the JetNine brand mark, all sized to social's expected
// 1200×630.
//
// generateImageMetadata declares one image per slug so each category
// gets its own static-generated card at build time rather than
// recomputing per request.

export const runtime = "edge";
export const size = { width: 1200, height: 630 } as const;
export const contentType = "image/png";
export const alt = "JetNine aircraft category";

type RouteParams = { params: Promise<{ category: string }> };

// generateImageMetadata enumerates the variants Next.js should
// statically prerender — one per fleet slug, so each category gets
// its own dedicated OG card at build time.
export async function generateImageMetadata() {
  const { FLEET } = await import("@/lib/fleet");
  return FLEET.map((f) => ({
    id: f.slug,
    alt: `JetNine ${f.name} — ${f.shortName}`,
    size,
    contentType,
  }));
}

export default async function CategoryOgImage({ params }: RouteParams) {
  const { category } = await params;
  const entry = getFleetEntry(category);
  if (!entry) notFound();

  // ImageResponse runs at the deployment edge, so /images/* paths
  // resolve against the deployment URL. NEXT_PUBLIC_SITE_URL drives
  // production routing; falls back to the Vercel-provided URL during
  // preview deploys so Satori can still fetch the background.
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://jetnine.com")
  ).replace(/\/$/, "");
  const bgUrl = `${base}${entry.imageUrl}`;

  const spec = `${entry.pax} pax · ${entry.rangeNm.toLocaleString()} NM · ${entry.speedKt} KT`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#07080A",
          color: "#F4F1EA",
          fontFamily: "ui-serif, Georgia, serif",
        }}
      >
        {/* Background photo */}
        <img
          src={bgUrl}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        {/* Dark gradient overlay for legibility on the photo */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(105deg, rgba(7,8,10,0.92) 0%, rgba(7,8,10,0.72) 38%, rgba(7,8,10,0.18) 70%, rgba(7,8,10,0) 100%)",
          }}
        />
        {/* Content stack */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 80px",
            width: "100%",
            height: "100%",
            zIndex: 1,
          }}
        >
          {/* Top — brand mark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 16,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#E8E2D2",
            }}
          >
            <span>—</span>
            <span>JetNine · {entry.kicker.replace(/^.+? · /, "")}</span>
          </div>

          {/* Middle — category headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                display: "flex",
                fontSize: 88,
                fontWeight: 300,
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
                maxWidth: 820,
              }}
            >
              {entry.title}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                lineHeight: 1.5,
                color: "#C9C4B8",
                maxWidth: 780,
                fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
                fontWeight: 400,
              }}
            >
              {entry.lead.slice(0, 140)}
            </div>
          </div>

          {/* Bottom — spec triple + domain */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 14,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#E8E2D2",
            }}
          >
            <span>{spec}</span>
            <span style={{ color: "#8A8678" }}>jetnine.com</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
