import { NextResponse } from "next/server";
import { HERO_LIBRARY } from "@/domain/blog/commands";
import { legacyRoute } from "../_legacy";

// GET /api/admin/blog/library → the pre-generated hero images with the
// topic clusters each suits. Deprecated: use /api/v1/blog/library.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = legacyRoute("/library", "/blog/library", async () => {
  return NextResponse.json({ ok: true, library: HERO_LIBRARY });
});
