import { NextResponse } from "next/server";
import { authorizeBlogAdmin } from "@/lib/blog-admin-auth";
import { HERO_LIBRARY } from "@/lib/blog-hero-library";

// GET /api/admin/blog/library → the pre-generated hero images with the
// topic clusters each suits, so a poster without image generation can
// still ship every article with a matching hero.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const identity = await authorizeBlogAdmin(req);
  if (!identity) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, library: HERO_LIBRARY });
}
