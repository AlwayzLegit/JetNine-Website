import Link from "next/link";
import type { BlogPost } from "@/db/schema/blog";
import { readingMinutes } from "@/lib/markdown";

export const postDateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export function postMeta(p: BlogPost): string {
  return [
    p.tags[0] ?? "Notes from the desk",
    p.publishedAt ? postDateFmt.format(p.publishedAt) : null,
    `${readingMinutes(p.bodyMd)} min read`,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Hero is a plain <img>: URLs may be site-relative or Supabase Storage,
// and next/image would need every host allow-listed.
export function PostImage({
  post,
  eager = false,
  className = "",
}: {
  post: BlogPost;
  eager?: boolean;
  className?: string;
}) {
  return (
    <div className={`aspect-[16/10] w-full overflow-hidden bg-surface-2 ${className}`}>
      {post.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.heroImageUrl}
          alt={post.heroImageAlt ?? post.title}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : null}
    </div>
  );
}

/**
 * One post in a grid. `plain` is the index grid (image, meta, title,
 * description); `card` wraps the same in a `.card` for the related row
 * under an article.
 */
export function PostCard({
  post,
  variant = "plain",
  headingLevel = "h3",
}: {
  post: BlogPost;
  variant?: "plain" | "card";
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const body = (
    <>
      <PostImage post={post} />
      <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.18em] text-gold">{postMeta(post)}</p>
      <Heading className="mt-[6px] font-serif text-[22px] font-normal leading-[1.15] text-bone group-hover:text-gold">
        {post.title}
      </Heading>
      <p className="mt-[6px] text-[14px] leading-[1.45] text-steel">{post.description}</p>
    </>
  );
  if (variant === "card") {
    return (
      <Link href={`/blog/${post.slug}`} className="group block border border-line bg-panel p-2 pb-4 [&>p]:px-2 [&>h2]:px-2 [&>h3]:px-2">
        {body}
      </Link>
    );
  }
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      {body}
    </Link>
  );
}
