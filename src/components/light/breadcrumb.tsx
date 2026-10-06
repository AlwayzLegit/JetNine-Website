import Link from "next/link";

export type Crumb = { label: string; href?: string };

/**
 * 12px steel breadcrumb from the light guide and model templates:
 * "Home / Guides / Charter fees". The last crumb is the current page.
 * Visual only — pages keep their own BreadcrumbList JSON-LD.
 */
export function Breadcrumb({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex gap-2 overflow-x-auto whitespace-nowrap text-[12px] text-steel ${className}`}>
      {items.map((c, i) => (
        <span key={c.label} className="flex gap-2">
          {i > 0 ? <span aria-hidden="true">/</span> : null}
          {c.href && i < items.length - 1 ? (
            <Link href={c.href} className="text-steel hover:text-gold">
              {c.label}
            </Link>
          ) : (
            <span aria-current={i === items.length - 1 ? "page" : undefined}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
