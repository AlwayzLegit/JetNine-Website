import { CtaBand } from "@/components/cta-band";
import { SITE } from "@/lib/constants";

type Props = {
  heading: string;
  body: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
};

/**
 * Compatibility wrapper. The closing band now renders the simplification
 * `CtaBand`; this keeps the old prop names (heading / body / primary /
 * secondary) so pages that still import `ClosingCTA` render on the new
 * grammar. Defaults match the old component: primary "Request a quote",
 * secondary "Call dispatch". New code should import `CtaBand` directly.
 */
export function ClosingCTA({
  heading,
  body,
  primary = { label: "Request a quote", href: "/quote/mission" },
  secondary,
}: Props) {
  const secondaryCta = secondary ?? {
    label: `Call dispatch · ${SITE.dispatchPhone}`,
    href: `tel:${SITE.dispatchPhoneE164}`,
  };
  return <CtaBand title={heading} body={body} primary={primary} secondary={secondaryCta} />;
}
