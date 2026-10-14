import "server-only";
import { unstable_cache } from "next/cache";
import { socialLinks } from "@/domain/settings/queries";

/**
 * The footer and the root layout run on every public page, most of which
 * are prerendered. Reading the social links through the data cache keeps
 * those pages static: the row is read at most once an hour, and saving
 * the links on Settings › Social links clears the tag at once.
 */
export const SOCIAL_LINKS_TAG = "social-links";

export const cachedSocialLinks = unstable_cache(socialLinks, [SOCIAL_LINKS_TAG], {
  tags: [SOCIAL_LINKS_TAG],
  revalidate: 3600,
});
