/**
 * Blog hero images in the deploy smoke test (OPS-289).
 *
 * Every hero the /blog page names must come out of R2 itself. The edge Worker answers a hero
 * that is not in the bucket with a library photo and the header X-Media-Stand-In, so a missing
 * hero looks like a normal image to a visitor; this reads each one and counts them. The pure
 * parts live here so they can be tested without a network (scripts/smoke-media.test.mts).
 */

/** Keep in sync with MEDIA_KEY in edge/worker.ts. */
const HERO_PATH = /\/media\/blog\/heroes\/[A-Za-z0-9._-]+\.webp/g;

/** The unique hero paths a page names, in order of first appearance. */
export function extractHeroPaths(html: string): string[] {
  return [...new Set(html.match(HERO_PATH) ?? [])];
}

export type HeroVerdict = "real" | "stand-in" | "failed";

/** A hero is real when it answers 200 with an image type and no stand-in header. */
export function classifyHero(status: number, headers: Pick<Headers, "get">): HeroVerdict {
  if (headers.get("x-media-stand-in")) return "stand-in";
  const type = headers.get("content-type") ?? "";
  return status === 200 && type.startsWith("image/") ? "real" : "failed";
}

export type HeroResult = { path: string; verdict: HeroVerdict; status: number };

/** The report lines: one summary line, then up to 10 lines naming the paths that are not real. */
export function heroReport(results: HeroResult[]): { lines: string[]; ok: boolean } {
  const count = (v: HeroVerdict) => results.filter((r) => r.verdict === v).length;
  const stand = results.filter((r) => r.verdict === "stand-in");
  const failed = results.filter((r) => r.verdict === "failed");
  const lines = [`media heroes: ${results.length} named, ${count("real")} real, ${stand.length} stand-in, ${failed.length} failed`];
  for (const r of stand.slice(0, 10)) lines.push(`media stand-in: ${r.path}`);
  for (const r of failed.slice(0, Math.max(0, 10 - Math.min(stand.length, 10)))) lines.push(`media failed: ${r.path} ${r.status}`);
  return { lines, ok: stand.length === 0 && failed.length === 0 };
}
