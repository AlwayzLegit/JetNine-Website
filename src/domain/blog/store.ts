import { d1Db, dbTarget } from "@/db";
import type { BlogPost, NewBlogPost } from "@/db/schema/blog";
import { d1BlogStore } from "./store-d1";
import { pgBlogStore } from "./store-pg";

// The blog's one door to the database (OPS-109). Every blog query goes through
// a BlogStore. There is one adapter per database, chosen per request by
// dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1" (staging
// first; the code refuses "d1" in production, see src/db/target.mjs).
// Return types are the existing Postgres row types, so callers do not change.

export type PostSummary = Pick<
  BlogPost,
  "id" | "slug" | "title" | "status" | "tags" | "author" | "publishedAt" | "updatedAt" | "createdAt"
>;

export type SitemapPost = Pick<BlogPost, "slug" | "updatedAt" | "heroImageUrl">;

export type DigestPostRow = Pick<BlogPost, "slug" | "title" | "description">;

/** The columns an update may set; the id and createdAt never change. */
export type PostPatch = Partial<Omit<NewBlogPost, "id" | "createdAt">>;

export type NewPost = Omit<NewBlogPost, "id" | "createdAt" | "updatedAt">;

export type SubscriberLookup = {
  id: string;
  status: "pending" | "confirmed" | "unsubscribed";
  confirmSentAt: Date | null;
};

export type ClaimedSubscriber = { id: string; email: string; unsubscribeToken: string };

export interface BlogStore {
  // ── posts ──
  /** Published posts, metadata only, for the sitemap. */
  sitemapPosts(): Promise<SitemapPost[]>;
  /** Published posts, newest first. */
  publishedPosts(): Promise<BlogPost[]>;
  publishedPost(slug: string): Promise<BlogPost | undefined>;
  /** Up to `limit` other published posts, newest first. */
  otherPublished(excludeId: string, limit: number): Promise<BlogPost[]>;
  /** Every post, drafts too, newest created first, without the body. */
  summaries(): Promise<PostSummary[]>;
  bySlug(slug: string): Promise<BlogPost | undefined>;
  slugTaken(slug: string): Promise<boolean>;
  insertPost(values: NewPost): Promise<BlogPost>;
  updatePost(id: string, patch: PostPatch): Promise<BlogPost>;
  deletePost(id: string): Promise<void>;
  /** Published posts newer than `since`, newest first, for the digest. */
  publishedSince(since: Date, limit: number): Promise<DigestPostRow[]>;

  // ── subscribers ──
  subscriberByEmail(emailLower: string): Promise<SubscriberLookup | undefined>;
  insertPendingSubscriber(v: { email: string; hash: string; expiresAt: Date; sentAt: Date }): Promise<void>;
  /** Back to pending with a fresh token: a re-request or an opt-in after unsubscribing. */
  resetSubscriberToPending(id: string, v: { hash: string; expiresAt: Date; sentAt: Date }): Promise<void>;
  subscriberByConfirmHash(hash: string): Promise<{ id: string; expiresAt: Date | null } | undefined>;
  confirmSubscriber(id: string, now: Date): Promise<void>;
  unsubscribeByToken(token: string, now: Date): Promise<void>;
  /**
   * Stamp last_digest_at on up to `limit` confirmed subscribers whose last
   * digest is null or older than `cutoff`, oldest first, and return them.
   */
  claimDigest(cutoff: Date, limit: number, now: Date): Promise<ClaimedSubscriber[]>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function blogStore(): BlogStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1BlogStore(client);
  }
  return pgBlogStore();
}
