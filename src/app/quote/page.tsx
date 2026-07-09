import { permanentRedirect } from "next/navigation";

// 308 permanent (not the default 307 temporary) so `/quote` — the vanity URL
// still referenced from a few auth-gated pages and external links — is a
// permanent redirect for crawlers. Public CTAs link straight to
// /quote/mission, so this is only hit off the main funnel.
export default function QuoteIndex() {
  permanentRedirect("/quote/mission");
}
