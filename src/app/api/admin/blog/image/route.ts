import { NextResponse } from "next/server";
import sharp from "sharp";
import { authorizeBlogAdmin } from "@/lib/blog-admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SLUG_RE } from "@/lib/blog";
import { HERO_LIBRARY } from "@/lib/blog-hero-library";

// Hero-image generation for blog posts.
//
//   POST /api/admin/blog/image  { slug, prompt }     →  { ok, url }
//   POST /api/admin/blog/image  { slug, sourceUrl }  →  { ok, url }
//
// Two inputs, one output. `prompt` generates a 16:9 image through the
// Hugging Face Inference router (HF_TOKEN; model via BLOG_IMAGE_MODEL,
// default FLUX.1-schnell). `sourceUrl` ingests an image that already
// exists somewhere over https — e.g. one produced by an image tool whose
// hosting is temporary. Either way the result is converted to 1536×864
// webp, uploaded to the public `blog` storage bucket, and returned as a
// durable public URL to pass as heroImageUrl. A `prompt` call with
// HF_TOKEN unset answers 503 carrying the pre-generated library so the
// caller can fall back without a second request.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const HOUSE_STYLE =
  "Editorial private-aviation photograph, premium magazine aesthetic, natural light, clean composition, no text, no logos, no watermarks, no visible faces.";

export async function POST(req: Request) {
  const identity = await authorizeBlogAdmin(req);
  if (!identity) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { prompt?: unknown; slug?: unknown; sourceUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: '"slug" must be lowercase-hyphenated.' }, { status: 400 });
  }
  if (!sourceUrl && (prompt.length < 10 || prompt.length > 1200)) {
    return NextResponse.json(
      { ok: false, error: 'Pass either "sourceUrl" (https) or a "prompt" of 10–1200 characters.' },
      { status: 400 },
    );
  }

  let raw: Buffer;
  let model = "ingest";
  if (sourceUrl) {
    if (!/^https:\/\//.test(sourceUrl) || sourceUrl.length > 2000) {
      return NextResponse.json({ ok: false, error: '"sourceUrl" must be an https:// URL.' }, { status: 400 });
    }
    const src = await fetch(sourceUrl, { headers: { Accept: "image/*" }, redirect: "follow" });
    const type = src.headers.get("content-type") ?? "";
    if (!src.ok || !type.startsWith("image/")) {
      return NextResponse.json(
        { ok: false, error: `sourceUrl did not return an image (${src.status} ${type || "no content-type"}).` },
        { status: 502 },
      );
    }
    raw = Buffer.from(await src.arrayBuffer());
    if (raw.length > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Source image exceeds 25 MB." }, { status: 413 });
    }
  } else {
    const generated = await generate(prompt);
    if (!generated.ok) return generated.response;
    raw = generated.buffer;
    model = generated.model;
  }

  const webp = await sharp(raw)
    .resize(1536, 864, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();

  const admin = createAdminClient();
  const path = `heroes/${slug}-${Date.now().toString(36)}.webp`;
  const { error } = await admin.storage
    .from("blog")
    .upload(path, webp, { contentType: "image/webp", upsert: false });
  if (error) {
    return NextResponse.json({ ok: false, error: `Storage upload failed: ${error.message}` }, { status: 502 });
  }
  const { data } = admin.storage.from("blog").getPublicUrl(path);

  return NextResponse.json({ ok: true, url: data.publicUrl, model, bytes: webp.length }, { status: 201 });
}

async function generate(
  prompt: string,
): Promise<{ ok: true; buffer: Buffer; model: string } | { ok: false; response: NextResponse }> {
  const token = process.env.HF_TOKEN;
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Image generation is not configured (HF_TOKEN unset). Pass a `sourceUrl` or pick a hero from `library`.",
          library: HERO_LIBRARY,
        },
        { status: 503 },
      ),
    };
  }

  const model = process.env.BLOG_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";
  const gen = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/*",
    },
    body: JSON.stringify({
      inputs: `${prompt}. ${HOUSE_STYLE}`,
      parameters: { width: 1536, height: 864 },
    }),
  });
  if (!gen.ok) {
    const detail = (await gen.text()).slice(0, 300);
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: `Image provider returned ${gen.status}: ${detail}`, library: HERO_LIBRARY },
        { status: 502 },
      ),
    };
  }
  return { ok: true, buffer: Buffer.from(await gen.arrayBuffer()), model };
}
