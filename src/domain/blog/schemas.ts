import { z } from "zod";

/**
 * Request shapes for the blog endpoints, used for the OpenAPI document.
 * Validation itself runs through validatePostInput (src/lib/blog.ts) so
 * the limits and messages stay identical for the legacy and v1 routes;
 * scripts/check-api.mts keeps the two in step on sample inputs.
 */

const faqItem = z.object({ q: z.string().min(1).max(200), a: z.string().min(1).max(1500) });

export const PostCreate = z
  .object({
    title: z.string().min(1).max(60),
    description: z.string().min(1).max(160).describe("Meta description, shown in search results."),
    bodyMd: z.string().min(1).max(400_000).describe("Markdown; sanitized at render time."),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(96).optional().describe("Derived from the title when omitted."),
    heroImageUrl: z.string().max(600).nullable().optional().describe("https:// URL or a site path starting with /."),
    heroImageAlt: z.string().max(300).nullable().optional(),
    tags: z.array(z.string().min(1).max(40)).max(10).optional(),
    faq: z.array(faqItem).max(12).optional(),
    author: z.string().min(1).max(120).optional(),
    status: z.enum(["draft", "published"]).optional().describe("Defaults to draft."),
    publishedAt: z.string().nullable().optional().describe("ISO date-time; defaults to now on first publish."),
  });

export const PostUpdate = PostCreate.partial();

export const HeroIngest = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    sourceUrl: z.string().max(2000).optional().describe("Public https image to ingest (private networks refused)."),
    prompt: z.string().min(10).max(1200).optional().describe("Generate with the Hugging Face router (needs HF_TOKEN)."),
  });

/** Input for the "blog.delete" operation; the slug comes from the path. */
export const BlogDeleteInput = z.object({
  slug: z.string().min(1).max(200),
});
export type BlogDeleteInput = z.infer<typeof BlogDeleteInput>;
