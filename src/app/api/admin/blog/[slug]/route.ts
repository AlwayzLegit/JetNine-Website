import { NextResponse } from "next/server";
import { deletePost, getPost, updatePost } from "@/domain/blog/commands";
import { err } from "@/domain/result";
import { legacyError, legacyRoute, readJson } from "../_legacy";

// Legacy admin blog API — single post by slug. Deprecated: use
// /api/v1/blog/posts/{slug} (docs/API.md). Shapes kept for existing callers.
//
//   GET    /api/admin/blog/[slug]  → fetch one post (draft or published)
//   PUT    /api/admin/blog/[slug]  → partial update; "status":"published" publishes
//   DELETE /api/admin/blog/[slug]  → hard delete

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const notFound = () => legacyError(err("not_found", "No post with that slug."));

export const GET = legacyRoute("/[slug]", "/blog/posts/{slug}", async (_actor, _req, params) => {
  const post = await getPost(params.slug);
  if (!post) return notFound();
  return NextResponse.json({ ok: true, post });
});

export const PUT = legacyRoute("/[slug]", "/blog/posts/{slug}", async (actor, req, params) => {
  // 404 before parsing the body, as before.
  if (!(await getPost(params.slug))) return notFound();
  const json = await readJson(req);
  if (!json.ok) return json.res;
  const r = await updatePost(actor, params.slug, json.body);
  if (!r.ok) return legacyError(r);
  return NextResponse.json({ ok: true, ...r.value });
});

export const DELETE = legacyRoute("/[slug]", "/blog/posts/{slug}", async (actor, _req, params) => {
  // Keys that ask before acting can't delete (same rule as /api/v1).
  if (actor.key?.supervised) {
    return legacyError(err("forbidden", "This key asks before acting and cannot delete posts. Unpublish instead."));
  }
  const r = await deletePost(actor, params.slug);
  if (!r.ok) return legacyError(r);
  return NextResponse.json({ ok: true, ...r.value });
});
