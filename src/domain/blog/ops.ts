import type { BlogPost } from "@/db/schema/blog";
import type { AnyOp } from "@/domain/ops";
import { defineOp } from "@/domain/ops/registry";
import { err, ok } from "@/domain/result";
import { deletePost, getPost } from "./commands";
import { BlogDeleteInput } from "./schemas";

/**
 * Blog operations. Only deleting goes through the registry: it is the one
 * blog write a supervised key may not do on its own (it is permanent), so
 * it is queued for a person. Creating and editing stay direct.
 */

export const blogDeleteOp = defineOp<BlogDeleteInput, BlogPost>({
  id: "blog.delete",
  scope: "content",
  schema: BlogDeleteInput,
  load: async ({ slug }) => {
    const post = await getPost(slug);
    return post ? ok(post) : err("not_found", "No post with that slug.");
  },
  risk: () => "content",
  summary: (_input, post) => `Delete the blog post “${post.title}”${post.status === "published" ? ", which is live" : ""}`,
  preview: () => null,
  subject: (input, post) => ({ type: "blog_post", id: post.id, code: input.slug }),
  // deletePost revalidates the blog pages and audits on its own.
  run: (actor, input) => deletePost(actor, input.slug),
});

export const BLOG_OPS: AnyOp[] = [blogDeleteOp];
