import { NextResponse } from "next/server";
import { createPost, listPosts } from "@/domain/blog/commands";
import { legacyError, legacyRoute, readJson } from "./_legacy";

// Legacy admin blog API — collection endpoints. Deprecated: use
// /api/v1/blog/posts (docs/API.md). Shapes kept for existing callers.
//
//   GET  /api/admin/blog        → list all posts (drafts included), newest first
//   POST /api/admin/blog        → create a post (draft by default)
//
// Auth: src/lib/blog-admin-auth.ts. Usage: BLOG_API.md.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = legacyRoute("", "/blog/posts", async () => {
  return NextResponse.json({ ok: true, posts: await listPosts() });
});

export const POST = legacyRoute("", "/blog/posts", async (actor, req) => {
  const json = await readJson(req);
  if (!json.ok) return json.res;
  const r = await createPost(actor, json.body);
  if (!r.ok) return legacyError(r);
  return NextResponse.json({ ok: true, ...r.value }, { status: 201 });
});
