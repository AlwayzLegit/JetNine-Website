import { getPublishedPosts } from "@/lib/blog";

// RSS 2.0 for the blog. Discovery + syndication; also a clean signal to
// crawlers that new posts exist between sitemap refreshes.
export const dynamic = "force-dynamic";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://jetnine.com").replace(/\/$/, "");
  let posts: Awaited<ReturnType<typeof getPublishedPosts>> = [];
  try {
    posts = await getPublishedPosts();
  } catch {
    posts = [];
  }
  const items = posts
    .map((p) => {
      const url = `${base}/blog/${p.slug}`;
      const img = p.heroImageUrl
        ? p.heroImageUrl.startsWith("/") ? `${base}${p.heroImageUrl}` : p.heroImageUrl
        : null;
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${esc(p.description)}</description>
      ${p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""}
      ${p.tags.map((t) => `<category>${esc(t)}</category>`).join("")}
      ${img ? `<enclosure url="${esc(img)}" type="image/webp" length="0" />` : ""}
    </item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>JetNine — notes from the desk</title>
    <link>${base}/blog</link>
    <atom:link href="${base}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <description>Private jet charter pricing, routes, aircraft and advice from the JetNine dispatch desk.</description>
    <language>en-us</language>
    ${posts[0]?.publishedAt ? `<lastBuildDate>${posts[0].publishedAt.toUTCString()}</lastBuildDate>` : ""}
${items}
  </channel>
</rss>`;
  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=900" },
  });
}
