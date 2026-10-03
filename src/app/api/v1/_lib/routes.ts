import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema/api";
import { SCOPE_WORDS } from "@/lib/api-keys";
import {
  HERO_LIBRARY,
  createPost,
  deletePost,
  getPost,
  ingestHero,
  listPosts,
  siteBase,
  updatePost,
} from "@/domain/blog/commands";
import { HeroIngest, PostCreate, PostUpdate } from "@/domain/blog/schemas";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "./handler";
import { buildOpenApi } from "./openapi";
import { DESK_ROUTES } from "./routes/desk";
import { HISTORY_ROUTES } from "./routes/history";
import { REQUEST_ROUTES } from "./routes/requests";
import { TRIP_ROUTES } from "./routes/trips";
import { REPORT_ROUTES } from "./routes/reports";
import { SETTINGS_ROUTES } from "./routes/settings";

/**
 * Every /api/v1 operation. The route.ts files are one-liners that export
 * `apiHandler(ROUTE.x)`; this list also generates openapi.json, and
 * scripts/check-api.mts checks each entry has a matching route file.
 */

const me: RouteDef = {
  method: "GET",
  path: "/me",
  operationId: "getMe",
  summary: "Who this key is",
  description: "The key's name, the person it acts as, and what it may do.",
  tag: "Discovery",
  scope: "any",
  run: async ({ actor }) => {
    const [key] = actor.key
      ? await db
          .select({ createdAt: apiKeys.createdAt, expiresAt: apiKeys.expiresAt, rateLimitPerMin: apiKeys.rateLimitPerMin })
          .from(apiKeys)
          .where(eq(apiKeys.id, actor.key.id))
          .limit(1)
      : [];
    return ok({
      data: {
        key: actor.key
          ? {
              id: actor.key.id,
              name: actor.key.name,
              asksBeforeActing: actor.key.supervised,
              createdAt: key?.createdAt ?? null,
              expiresAt: key?.expiresAt ?? null,
              rateLimitPerMin: key?.rateLimitPerMin ?? null,
            }
          : null,
        actsAs: { userId: actor.userId, role: actor.role },
        scopes: [...actor.scopes].map((s) => ({ scope: s, ...SCOPE_WORDS[s] })),
        runId: actor.runId ?? null,
      },
    });
  },
};

const openapi: RouteDef = {
  method: "GET",
  path: "/openapi.json",
  operationId: "getOpenApi",
  summary: "This API's OpenAPI document",
  tag: "Discovery",
  scope: "any",
  run: async () => ok({ data: buildOpenApi(ROUTES, siteBase()) }),
};

// ─── Blog ────────────────────────────────────────────────────────────────

const listBlogPosts: RouteDef = {
  method: "GET",
  path: "/blog/posts",
  operationId: "listBlogPosts",
  summary: "List blog posts",
  description: "All posts, drafts included, newest first. Bodies are left out; fetch one post for its body.",
  tag: "Blog",
  scope: "content",
  run: async () => ok({ data: await listPosts() }),
};

const createBlogPost: RouteDef = {
  method: "POST",
  path: "/blog/posts",
  operationId: "createBlogPost",
  summary: "Create a blog post",
  description: 'Draft by default; pass `"status": "published"` to publish now. 409 if the slug is taken.',
  tag: "Blog",
  scope: "content",
  approval: "never",
  body: PostCreate,
  validateBody: false,
  successStatus: 201,
  run: async ({ actor, body }) => {
    const r = await createPost(actor, body);
    return r.ok ? ok({ data: r.value, status: 201 }) : r;
  },
};

const getBlogPost: RouteDef = {
  method: "GET",
  path: "/blog/posts/{slug}",
  operationId: "getBlogPost",
  summary: "Get one blog post",
  tag: "Blog",
  scope: "content",
  run: async ({ params }) => {
    const post = await getPost(params.slug);
    return post ? ok({ data: post }) : err("not_found", "No post with that slug.");
  },
};

const updateBlogPost: RouteDef = {
  method: "PUT",
  path: "/blog/posts/{slug}",
  operationId: "updateBlogPost",
  summary: "Update a blog post",
  description: 'Partial update. `"status": "published"` publishes; `"draft"` unpublishes.',
  tag: "Blog",
  scope: "content",
  approval: "never",
  body: PostUpdate,
  validateBody: false,
  run: async ({ actor, params, body }) => {
    const r = await updatePost(actor, params.slug, body);
    return r.ok ? ok({ data: r.value }) : r;
  },
};

const deleteBlogPost: RouteDef = {
  method: "DELETE",
  path: "/blog/posts/{slug}",
  operationId: "deleteBlogPost",
  summary: "Delete a blog post",
  description: "Permanent. Keys that ask before acting cannot delete; unpublish instead.",
  tag: "Blog",
  scope: "content",
  approval: "always",
  run: async ({ actor, params }) => {
    const r = await deletePost(actor, params.slug);
    return r.ok ? ok({ data: r.value }) : r;
  },
};

const createBlogImage: RouteDef = {
  method: "POST",
  path: "/blog/images",
  operationId: "createBlogImage",
  summary: "Make a hero image",
  description:
    "Ingest a public https image (`sourceUrl`) or generate one (`prompt`). Returns a durable URL for `heroImageUrl`. Failures include the hero `library` in `error.details` so you can fall back.",
  tag: "Blog",
  scope: "content",
  approval: "never",
  body: HeroIngest,
  validateBody: false,
  successStatus: 201,
  run: async ({ actor, body }) => {
    const r = await ingestHero(actor, body);
    return r.ok ? ok({ data: r.value, status: 201 }) : r;
  },
};

const listBlogLibrary: RouteDef = {
  method: "GET",
  path: "/blog/library",
  operationId: "listBlogLibrary",
  summary: "Ready-made hero images",
  description: "Pre-generated heroes with the topics each suits. URLs are site paths.",
  tag: "Blog",
  scope: "content",
  run: async () => ok({ data: HERO_LIBRARY }),
};

export const ROUTE = {
  me,
  openapi,
  listBlogPosts,
  createBlogPost,
  getBlogPost,
  updateBlogPost,
  deleteBlogPost,
  createBlogImage,
  listBlogLibrary,
  ...DESK_ROUTES,
  ...REQUEST_ROUTES,
  ...TRIP_ROUTES,
  ...REPORT_ROUTES,
  ...HISTORY_ROUTES,
  ...SETTINGS_ROUTES,
} satisfies Record<string, RouteDef>;

export const ROUTES: RouteDef[] = Object.values(ROUTE);
