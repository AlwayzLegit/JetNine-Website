import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const blogSubscriberStatusEnum = pgEnum("blog_subscriber_status", [
  "pending",
  "confirmed",
  "unsubscribed",
]);

// ─── blog_subscribers ────────────────────────────────────────────────────
// Double opt-in email list for the daily blog. Consent model mirrors
// empty-leg watchlists: rows start 'pending' and receive nothing until the
// confirm link is used; the confirm token is stored only as a SHA-256
// hash; the unsubscribe token is plain (it only ever stops mail). The
// weekly digest cron claims rows via last_digest_at before sending.

export const blogSubscribers = pgTable(
  "blog_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    status: blogSubscriberStatusEnum("status").notNull().default("pending"),

    confirmTokenHash: text("confirm_token_hash"),
    confirmExpiresAt: timestamp("confirm_expires_at", { withTimezone: true }),
    confirmSentAt: timestamp("confirm_sent_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),

    unsubscribeToken: text("unsubscribe_token")
      .notNull()
      .default(sql`encode(gen_random_bytes(24), 'hex')`),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),

    lastDigestAt: timestamp("last_digest_at", { withTimezone: true }),

    source: text("source").notNull().default("blog"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("blog_subscribers_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("blog_subscribers_unsub_token_uq").on(t.unsubscribeToken),
    index("blog_subscribers_status_idx").on(t.status),
  ],
);

export type BlogSubscriber = typeof blogSubscribers.$inferSelect;
