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
    <div className={`aspect-[16/9] w-full overflow-hidden rounded-card bg-surface-2 ${className}`}>
      {post.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.heroImageUrl}
          alt={post.heroImageAlt ?? post.title}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          className="h-full w-full object-cover"
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
      <p className="label-jn mt-3.5">{postMeta(post)}</p>
      <Heading className="title-card-sm mt-1.5 text-bone">{post.title}</Heading>
      <p className="mt-2 text-[15px] text-bone-2">{post.description}</p>
    </>
  );
  if (variant === "card") {
    return (
      <Link href={`/blog/${post.slug}`} className="card p-5">
        {body}
      </Link>
    );
  }
  return (
    <Link href={`/blog/${post.slug}`} className="block">
      {body}
    </Link>
  );
}
