import Link from "next/link";
import { getPostsForTopics } from "@/lib/blog";

// "From the desk" — up to three blog posts relevant to the page. The band
// closes the link graph: posts already point into routes, cities, models
// and questions; this points those pages back at the posts. Renders
// nothing when the DB is unreachable (local builds) or there are no posts.
export async function DeskNotes({
  terms,
  heading = "From the desk",
}: {
  terms: string[];
  heading?: string;
}) {
  let posts: Awaited<ReturnType<typeof getPostsForTopics>> = [];
  try {
    posts = await getPostsForTopics(terms, 3);
  } catch {
    return null;
  }
  if (posts.length === 0) return null;

  return (
    <section className="section-jn">
      <div className="container-jn">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <h2 className="title-section">{heading}</h2>
          <Link href="/blog" className="text-link text-[15px]">
            All notes <span className="arrow">→</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group block">
              <div className="aspect-[16/9] w-full overflow-hidden rounded-card bg-surface-2">
                {p.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.heroImageUrl}
                    alt={p.heroImageAlt ?? p.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : null}
              </div>
              <p className="label-jn mt-[14px]">{p.tags[0] ?? "Notes from the desk"}</p>
              <h3 className="title-card-sm mt-1.5 text-bone transition-colors group-hover:text-clearance">
                {p.title}
              </h3>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-[1.55] text-bone-2">{p.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
