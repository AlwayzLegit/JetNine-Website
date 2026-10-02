import { NextResponse } from "next/server";
import { ingestHero } from "@/domain/blog/commands";
import { legacyError, legacyRoute, readJson } from "../_legacy";

// Legacy hero-image endpoint. Deprecated: use /api/v1/blog/images.
//
//   POST /api/admin/blog/image  { slug, prompt }     →  { ok, url, model, bytes }
//   POST /api/admin/blog/image  { slug, sourceUrl }  →  { ok, url, model, bytes }
//
// `prompt` generates through the Hugging Face router (HF_TOKEN); with it
// unset the answer is 503 carrying `library` so the caller can fall back.
// `sourceUrl` ingests a public https image (private networks refused).
// Either way: 1536×864 webp in the public `blog` bucket.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = legacyRoute("/image", "/blog/images", async (actor, req) => {
  const json = await readJson(req);
  if (!json.ok) return json.res;
  const r = await ingestHero(actor, json.body);
  if (!r.ok) return legacyError(r);
  return NextResponse.json({ ok: true, ...r.value }, { status: 201 });
});
