/**
 * JetNine's social profiles (Settings › Social links). Shown as icons in
 * the site footer and listed as `sameAs` on the Organization structured
 * data, so search engines tie the profiles to the business.
 *
 * Pure module: no database, no `server-only`, so check:api can load it.
 * The stored row lives in `desk_settings` under SOCIAL_LINKS_KEY as
 * { instagram: "https://…", … } with only the platforms that are set.
 */

export const SOCIAL_LINKS_KEY = "social_links";

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "linkedin", "x", "tiktok", "youtube", "threads"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialLinks = Partial<Record<SocialPlatform, string>>;

type PlatformMeta = {
  label: string;
  /** Hosts a profile link may live on (any subdomain of these). */
  hosts: string[];
  /** Turn a bare handle into the profile URL. */
  fromHandle: (handle: string) => string;
  placeholder: string;
};

export const SOCIAL_META: Record<SocialPlatform, PlatformMeta> = {
  instagram: {
    label: "Instagram",
    hosts: ["instagram.com"],
    fromHandle: (h) => `https://www.instagram.com/${h}/`,
    placeholder: "https://www.instagram.com/jetnine/ or @jetnine",
  },
  facebook: {
    label: "Facebook",
    hosts: ["facebook.com", "fb.com"],
    fromHandle: (h) => `https://www.facebook.com/${h}`,
    placeholder: "https://www.facebook.com/jetnine",
  },
  linkedin: {
    label: "LinkedIn",
    hosts: ["linkedin.com"],
    fromHandle: (h) => `https://www.linkedin.com/company/${h}/`,
    placeholder: "https://www.linkedin.com/company/jetnine/",
  },
  x: {
    label: "X",
    hosts: ["x.com", "twitter.com"],
    fromHandle: (h) => `https://x.com/${h}`,
    placeholder: "https://x.com/jetnine or @jetnine",
  },
  tiktok: {
    label: "TikTok",
    hosts: ["tiktok.com"],
    fromHandle: (h) => `https://www.tiktok.com/@${h}`,
    placeholder: "https://www.tiktok.com/@jetnine",
  },
  youtube: {
    label: "YouTube",
    hosts: ["youtube.com", "youtu.be"],
    fromHandle: (h) => `https://www.youtube.com/@${h}`,
    placeholder: "https://www.youtube.com/@jetnine",
  },
  threads: {
    label: "Threads",
    hosts: ["threads.net", "threads.com"],
    fromHandle: (h) => `https://www.threads.net/@${h}`,
    placeholder: "https://www.threads.net/@jetnine",
  },
};

export function isSocialPlatform(v: unknown): v is SocialPlatform {
  return typeof v === "string" && (SOCIAL_PLATFORMS as readonly string[]).includes(v);
}

const HANDLE_RE = /^@?([A-Za-z0-9._-]{1,60})$/;
/** "instagram.com" is a domain; "jet.nine" is a handle with a dot in it. */
const LOOKS_LIKE_DOMAIN = /\.(com|net|org|co|io|tv|be|app|me|us|uk)$/i;

/**
 * What someone typed → the profile URL for that platform, or why not.
 * Accepts a full link on the platform's own domain (any subdomain, with
 * or without https://) or a bare handle like "@jetnine". Empty → null.
 */
export function normalizeSocialLink(
  platform: SocialPlatform,
  input: string,
): { ok: true; url: string | null } | { ok: false; error: string } {
  const meta = SOCIAL_META[platform];
  const raw = input.trim();
  if (!raw) return { ok: true, url: null };

  const handle = HANDLE_RE.exec(raw);
  if (handle && !LOOKS_LIKE_DOMAIN.test(raw)) return { ok: true, url: meta.fromHandle(handle[1]) };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: `That doesn't look like a ${meta.label} link or handle` };
  }
  const host = url.hostname.toLowerCase();
  const onPlatform = meta.hosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (!onPlatform) return { ok: false, error: `A ${meta.label} link lives on ${meta.hosts[0]}` };
  if (url.pathname === "/" || url.pathname === "") return { ok: false, error: `Add the profile, not just ${meta.hosts[0]}` };
  url.protocol = "https:";
  url.hash = "";
  // Tracking params never belong in a footer link.
  url.search = "";
  return { ok: true, url: url.toString() };
}

/** A stored row, read leniently: only known platforms with https links on their own domain. Never throws. */
export function parseSocialLinks(raw: unknown): SocialLinks {
  const out: SocialLinks = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSocialPlatform(k) || typeof v !== "string") continue;
    const r = normalizeSocialLink(k, v);
    if (r.ok && r.url) out[k] = r.url;
  }
  return out;
}

/** Platforms in display order, only those set. */
export function socialLinkList(links: SocialLinks): { platform: SocialPlatform; label: string; url: string }[] {
  return SOCIAL_PLATFORMS.filter((p) => links[p]).map((p) => ({ platform: p, label: SOCIAL_META[p].label, url: links[p]! }));
}

/** One line for History: "Instagram, LinkedIn and X" or "none". */
export function socialLinksWords(links: SocialLinks): string {
  const names = socialLinkList(links).map((l) => l.label);
  if (names.length === 0) return "none";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
