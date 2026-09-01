import { NextResponse } from "next/server";
import sharp from "sharp";
import { authorizeBlogAdmin } from "@/lib/blog-admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SLUG_RE } from "@/lib/blog";
import { HERO_LIBRARY } from "@/lib/blog-hero-library";

// Hero-image generation for blog posts.
//
//   POST /api/admin/blog/image  { prompt, slug }  →  { ok, url, alt? }
//
// Generates a 16:9 image through the Hugging Face Inference router
// (HF_TOKEN; model via BLOG_IMAGE_MODEL, default FLUX.1-schnell), converts
// to webp, uploads to the public `blog` storage bucket, and returns the
// public URL to pass as heroImageUrl. When HF_TOKEN is unset the route
// answers 503 with the pre-generated library so callers can fall back
// without a second request.

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

  let body: { prompt?: unknown; slug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (prompt.length < 10 || prompt.length > 1200) {
    return NextResponse.json({ ok: false, error: '"prompt" must be 10–1200 characters.' }, { status: 400 });
  }
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: '"slug" must be lowercase-hyphenated.' }, { status: 400 });
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error: "Image generation is not configured (HF_TOKEN unset). Pick a hero from `library` instead.",
        library: HERO_LIBRARY,
      },
      { status: 503 },
    );
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
    return NextResponse.json(
      { ok: false, error: `Image provider returned ${gen.status}: ${detail}`, library: HERO_LIBRARY },
      { status: 502 },
    );
  }

  const raw = Buffer.from(await gen.arrayBuffer());
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
