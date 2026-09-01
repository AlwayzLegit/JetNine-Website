import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

// Blog bodies arrive as markdown through the admin API and are stored as
// source. This is the single place they become HTML — always sanitized,
// even though the API is authed, so a compromised key can deface copy but
// never inject script into visitor sessions.

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4",
    "p", "br", "hr",
    "strong", "em", "del", "sup", "sub",
    "a", "img",
    "ul", "ol", "li",
    "blockquote", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    th: ["align", "colspan"],
    td: ["align", "colspan"],
    h2: ["id"],
    h3: ["id"],
    h4: ["id"],
  },
  allowedSchemes: ["https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  // Site-relative links (/routes/…, /guides/…) are the common case in
  // desk-written posts and must survive sanitization.
  allowProtocolRelative: false,
  transformTags: {
    // A post's H1 is the page title — demote stray in-body H1s.
    h1: "h2",
    img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
  },
};

const slugifyHeading = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);

export function renderMarkdown(markdown: string): string {
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const inline = renderer.parser.parseInline(tokens);
    const level = Math.min(Math.max(depth, 2), 4);
    const id = slugifyHeading(inline);
    return `<h${level}${id ? ` id="${id}"` : ""}>${inline}</h${level}>\n`;
  };

  const raw = marked.parse(markdown, {
    gfm: true,
    breaks: false,
    renderer,
    async: false,
  });
  return sanitizeHtml(raw, SANITIZE_OPTIONS);
}

// Plain-text word count → reading time, floor of 1 minute.
export function readingMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`\[\]()!-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

// Pull the H2 anchors out of rendered HTML for the on-page table of
// contents. Only H2s — the TOC should read like a chapter list, not an
// outline.
export function extractToc(html: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const re = /<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = m[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (text) out.push({ id: m[1], text });
  }
  return out;
}
