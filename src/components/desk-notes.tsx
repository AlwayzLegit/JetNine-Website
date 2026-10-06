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

  // Light grammar: the Home "Fly informed." guide-card row.
  return (
    <section className="container-jn mt-14">
      <div className="flex flex-wrap items-end justify-between gap-6 border-t border-line pt-10">
        <div>
          <p className="eyebrow">From the Journal</p>
          <h2 className="title-section !text-[clamp(30px,7vw,40px)]">{heading}</h2>
        </div>
        <Link href="/blog" className="rule-link !text-[16px]">
          All notes <span className="arrow-sm" aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="mt-[22px] grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="group block">
            <div className="aspect-[2/1] w-full overflow-hidden bg-surface-2">
              {p.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.heroImageUrl}
                  alt={p.heroImageAlt ?? p.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              ) : null}
            </div>
            <p className="eyebrow !mb-0 mt-3">{p.tags[0] ?? "Notes from the desk"}</p>
            <h3 className="title-card-sm mt-[6px] transition-colors group-hover:text-gold">{p.title}</h3>
            <p className="mt-2 max-w-[48ch] font-serif text-[15px] leading-[1.5] text-steel">{p.description}</p>
            <span className="rule-link mt-[10px] group-hover:text-gold">
              Read note <span className="arrow-sm" aria-hidden="true">↗</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
