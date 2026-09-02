import Link from "next/link";
import { Reveal } from "@/components/reveal";
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
    <section className="border-t border-ink-3 py-20 max-md:py-14">
      <div className="container-jn">
        <Reveal className="mb-8 flex items-baseline justify-between gap-6">
          <p className="caption">— {heading}</p>
          <Link
            href="/blog"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance transition-colors hover:text-bone"
          >
            All notes <span className="arrow">→</span>
          </Link>
        </Reveal>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {posts.map((p) => (
            <Reveal key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="group block">
                <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-[2px] bg-ink-3">
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
                <p className="caption mb-2">{p.tags[0] ?? "Notes from the desk"}</p>
                <h3 className="font-serif text-[20px] font-normal leading-[1.25] tracking-tight text-bone transition-colors group-hover:text-clearance">
                  {p.title}
                </h3>
                <p className="mt-2 max-w-[48ch] text-[14px] leading-[1.55] text-bone-2">{p.description}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
