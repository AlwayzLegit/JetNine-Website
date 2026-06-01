// Skip-to-content link for keyboard users. WCAG 2.1 §2.4.1 (bypass blocks)
// expects a means to jump past repeated navigation; with the SiteNav fixed
// at the top of every page, tabbing through the nav before reaching the
// page content is otherwise unavoidable.
//
// Hidden visually (off-screen via .sr-only) until focused — once it
// receives keyboard focus, .focus:not-sr-only pulls it back into the
// viewport at the top-left. Pointing at #main-content (which the layouts
// place on the <main> wrapper) lets a screen reader announce the skip
// AND lets a sighted keyboard user see exactly where they're going.
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:items-center focus:gap-2 focus:rounded focus:bg-bone focus:px-4 focus:py-2 focus:font-mono focus:text-[11px] focus:uppercase focus:tracking-[0.14em] focus:text-ink focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-clearance focus:ring-offset-2 focus:ring-offset-ink"
    >
      Skip to content <span aria-hidden>↓</span>
    </a>
  );
}
