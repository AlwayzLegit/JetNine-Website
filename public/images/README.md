# Marketing imagery

This folder backs the `imageUrl` paths referenced from `Placeholder`
consumers across the home page + `/aircraft` index. The `Placeholder`
component gracefully falls back to its CSS scanline pattern when a
file is missing — so it's safe to land code that references images
before the assets are staged.

## Expected files

All ten files are AI-generated **placeholders**. Real photography
should replace each one before public launch.

| Path | Aspect | Source / notes |
|---|---|---|
| `programs/tarmac-dusk.webp` | 16/10 | FLUX Krea — business jet silhouetted on tarmac at dusk. Editorial composition. |
| `programs/black-card.webp` | 16/10 | FLUX Krea — black metal charge card top-down with gold-embossed "09". |
| `programs/reposition-sector.webp` | 16/10 | FLUX Krea — abstract minimal flight-path arcs over a stylized coastline. |
| `discretion/tail-night.webp` | 4/5 | Qwen-Image — unmarked dark business jet on night tarmac, warm runway bokeh. |
| `fleet/turboprop.webp` | 4/5 | FLUX Krea — twin-turboprop on mountain airstrip at golden hour. |
| `fleet/light.webp` | 4/5 | FLUX Krea — light jet on tarmac at dawn beside hangar. |
| `fleet/midsize.webp` | 4/5 | FLUX Krea — midsize jet overwing perspective at cruise. |
| `fleet/supermid.webp` | 4/5 | Qwen-Image — super-midsize jet polished pearl-grey in cruise above ocean. |
| `fleet/heavy.webp` | 4/5 | FLUX Krea — heavy jet banking turn over ocean at twilight. |
| `fleet/ultra.webp` | 4/5 | FLUX Krea — ultra-long-range jet at dawn above cirrus cloud horizon. |

## Replacement guidance

When real photography becomes available:

1. Keep the same filename + aspect ratio so the wiring doesn't need to
   change.
2. Prefer WebP (or AVIF) — `next/image` will still serve fallbacks for
   older browsers, but the source format matters for compression.
3. Target output dimensions:
   - Programs (16/10): ≥ 1280×800 raw
   - Discretion (4/5) — single hero: ≥ 1024×1280
   - Fleet thumbnails (4/5) — ≥ 820×1024
4. Strip EXIF / location data before committing — leak risk on private
   aviation photography.

## Why placeholders shipped before the photos

We didn't want the home page to launch with CSS scanlines where real
imagery should sit. The placeholder approach lets the page populate
progressively as files are added — no code change required per asset.

## Favicon / OG image

Both are code-rendered via Next.js `ImageResponse`:
- `/src/app/icon.tsx` — serif "09" monogram on the ink-deep background
- `/src/app/opengraph-image.tsx` — pre-existing branded OG card

Neither has a corresponding file in this folder.
