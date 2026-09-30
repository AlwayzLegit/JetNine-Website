import { PageHero } from "@/components/page-hero";

type Props = {
  kicker: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  imagePosition?: string;
};

/**
 * Compatibility wrapper. The marketing-page header now renders the
 * simplification hero (`PageHero`); this keeps the old prop names so
 * pages that still import `PageHeader` render on the new grammar without
 * changes. New code should import `PageHero` directly.
 */
export function PageHeader({ kicker, title, lead, imageSrc, imageAlt, imagePosition }: Props) {
  return (
    <PageHero
      eyebrow={kicker}
      title={title}
      lead={lead}
      imageSrc={imageSrc}
      imageAlt={imageAlt}
      imagePosition={imagePosition}
    />
  );
}
