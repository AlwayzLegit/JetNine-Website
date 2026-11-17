import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts } from "@/db/schema/blog";
import { blogSubscribers } from "@/db/schema/blog-subscribers";
import type { BlogStore } from "./store";

// The Postgres side of the blog store (OPS-109): the queries that lived in
// src/lib/blog.ts, src/domain/blog/commands.ts and the subscriber code, moved
// as they were. The one change is the digest claim, which binds a cutoff
// worked out in the app instead of `now() - interval '6 days'`, so both
// databases share one rule.

export function pgBlogStore(): BlogStore {
  return {
    async sitemapPosts() {
      return db
        .select({
          slug: blogPosts.slug,
          updatedAt: blogPosts.updatedAt,
          heroImageUrl: blogPosts.heroImageUrl,
        })
        .from(blogPosts)
        .where(eq(blogPosts.status, "published"));
    },

    async publishedPosts() {
      return db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.status, "published"))
        .orderBy(desc(blogPosts.publishedAt));
    },

    async publishedPost(slug) {
      const [row] = await db
        .select()
        .from(blogPosts)
        .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")))
        .limit(1);
      return row;
    },

    async otherPublished(excludeId, limit) {
      return db
        .select()
        .from(blogPosts)
        .where(and(eq(blogPosts.status, "published"), ne(blogPosts.id, excludeId)))
        .orderBy(desc(blogPosts.publishedAt))
        .limit(limit);
    },

    async summaries() {
      return db
        .select({
          id: blogPosts.id,
          slug: blogPosts.slug,
          title: blogPosts.title,
          status: blogPosts.status,
          tags: blogPosts.tags,
          author: blogPosts.author,
          publishedAt: blogPosts.publishedAt,
          updatedAt: blogPosts.updatedAt,
          createdAt: blogPosts.createdAt,
        })
        .from(blogPosts)
        .orderBy(desc(blogPosts.createdAt));
    },

    async bySlug(slug) {
      const [row] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
      return row;
    },

    async slugTaken(slug) {
      const [row] = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
      return Boolean(row);
    },

    async insertPost(values) {
      const [post] = await db.insert(blogPosts).values(values).returning();
      return post;
    },

    async updatePost(id, patch) {
      const [updated] = await db.update(blogPosts).set(patch).where(eq(blogPosts.id, id)).returning();
      return updated;
    },

    async deletePost(id) {
      await db.delete(blogPosts).where(eq(blogPosts.id, id));
    },

    async publishedSince(since, limit) {
      return db
        .select({
          slug: blogPosts.slug,
          title: blogPosts.title,
          description: blogPosts.description,
        })
        .from(blogPosts)
        .where(and(eq(blogPosts.status, "published"), gt(blogPosts.publishedAt, since)))
        .orderBy(desc(blogPosts.publishedAt))
        .limit(limit);
    },

    async subscriberByEmail(emailLower) {
      const [row] = await db
        .select({
          id: blogSubscribers.id,
          status: blogSubscribers.status,
          confirmSentAt: blogSubscribers.confirmSentAt,
        })
        .from(blogSubscribers)
        .where(eq(sql`lower(${blogSubscribers.email})`, emailLower))
        .limit(1);
      return row;
    },

    async insertPendingSubscriber({ email, hash, expiresAt, sentAt }) {
      await db.insert(blogSubscribers).values({
        email,
        status: "pending",
        confirmTokenHash: hash,
        confirmExpiresAt: expiresAt,
        confirmSentAt: sentAt,
      });
    },

    async resetSubscriberToPending(id, { hash, expiresAt, sentAt }) {
      await db
        .update(blogSubscribers)
        .set({
          status: "pending",
          confirmTokenHash: hash,
          confirmExpiresAt: expiresAt,
          confirmSentAt: sentAt,
          unsubscribedAt: null,
          updatedAt: sentAt,
        })
        .where(eq(blogSubscribers.id, id));
    },

    async subscriberByConfirmHash(hash) {
      const [row] = await db
        .select({ id: blogSubscribers.id, expiresAt: blogSubscribers.confirmExpiresAt })
        .from(blogSubscribers)
        .where(eq(blogSubscribers.confirmTokenHash, hash))
        .limit(1);
      return row;
    },

    async confirmSubscriber(id, now) {
      await db
        .update(blogSubscribers)
        .set({ status: "confirmed", confirmedAt: now, confirmTokenHash: null, updatedAt: now })
        .where(eq(blogSubscribers.id, id));
    },

    async unsubscribeByToken(token, now) {
      await db
        .update(blogSubscribers)
        .set({ status: "unsubscribed", unsubscribedAt: now, updatedAt: now })
        .where(eq(blogSubscribers.unsubscribeToken, token));
    },

    async claimDigest(cutoff, limit, now) {
      return db
        .update(blogSubscribers)
        .set({ lastDigestAt: now, updatedAt: now })
        .where(
          sql`${blogSubscribers.id} in (
            select id from ${blogSubscribers}
            where status = 'confirmed'
              and (last_digest_at is null or last_digest_at < ${cutoff.toISOString()}::timestamptz)
            order by created_at asc
            limit ${limit}
          )`,
        )
        .returning({
          id: blogSubscribers.id,
          email: blogSubscribers.email,
          unsubscribeToken: blogSubscribers.unsubscribeToken,
        });
    },
  };
}

