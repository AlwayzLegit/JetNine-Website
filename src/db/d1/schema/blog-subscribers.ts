// D1 (SQLite) twin of src/db/schema/blog-subscribers.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, hexToken24, newId } from "../helpers";
import { blogSubscriberStatusEnum } from "../../schema/blog-subscribers";


// ─── blog_subscribers ────────────────────────────────────────────────────
// Double opt-in email list for the daily blog. Consent model mirrors
// empty-leg watchlists: rows start 'pending' and receive nothing until the
// confirm link is used; the confirm token is stored only as a SHA-256
// hash; the unsubscribe token is plain (it only ever stops mail). The
// weekly digest cron claims rows via last_digest_at before sending.

export const blogSubscribers = sqliteTable(
  "blog_subscribers",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    email: text("email").notNull(),
    status: text("status", { enum: blogSubscriberStatusEnum.enumValues }).notNull().default("pending"),

    confirmTokenHash: text("confirm_token_hash"),
    confirmExpiresAt: integer("confirm_expires_at", { mode: "timestamp_ms" }),
    confirmSentAt: integer("confirm_sent_at", { mode: "timestamp_ms" }),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),

    unsubscribeToken: text("unsubscribe_token")
      .notNull()
      .$defaultFn(hexToken24),
    unsubscribedAt: integer("unsubscribed_at", { mode: "timestamp_ms" }),

    lastDigestAt: integer("last_digest_at", { mode: "timestamp_ms" }),

    source: text("source").notNull().default("blog"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("blog_subscribers_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("blog_subscribers_unsub_token_uq").on(t.unsubscribeToken),
    index("blog_subscribers_status_idx").on(t.status),
    enumCheck("blog_subscribers_status_enum", t.status, blogSubscriberStatusEnum.enumValues),
  ]);

