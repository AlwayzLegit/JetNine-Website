import Link from "next/link";
import { SITE } from "@/lib/constants";

export type SubmitError = { code: string; retryAfterMs?: number };

/**
 * The one primary action on the review step. Errors read as a sentence
 * but keep the raw code in parentheses — the production smoke test greps
 * for RATE_LIMITED | NETWORK | MISSING_.
 */
export function ReviewSubmitCard({
  submitting,
  error,
  onSubmit,
}: {
  submitting: boolean;
  error: SubmitError | null;
  onSubmit: () => void;
}) {
  return (
    <section className="mt-3 rounded-[3px] border border-clearance px-5 py-5">
      <h2 className="font-serif text-[26px] leading-[1.15] text-bone">
        Send it to dispatch.
      </h2>
      <p className="mt-2 max-w-[72ch] text-[14px] leading-[1.55] text-steel">
        By submitting, you agree to the{" "}
        <Link href="/legal#part-295" className="text-link-strong">
          Part 295 broker disclosure
        </Link>{" "}
        &amp;{" "}
        <Link href="/legal#agreement" className="text-link-strong">
          terms of service
        </Link>
        . Quote requests are not commitments — you&rsquo;ll review specific aircraft and pricing
        before anything is booked.
      </p>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        aria-busy={submitting || undefined}
        className="btn btn-primary mt-[18px] !h-12 w-full !text-[16px]"
      >
        {submitting ? "Sending…" : "Submit quote request"}{" "}
        <span className="arrow" aria-hidden>
          →
        </span>
      </button>
      {error ? (
        <p className="mt-3 text-[14px] text-danger" role="alert">
          <ErrorSentence error={error} />
        </p>
      ) : null}
    </section>
  );
}

function ErrorSentence({ error }: { error: SubmitError }) {
  if (error.code === "RATE_LIMITED") {
    const mins = error.retryAfterMs ? Math.max(1, Math.ceil(error.retryAfterMs / 60_000)) : 5;
    return (
      <>
        Too many requests — try again in about {mins} {mins === 1 ? "minute" : "minutes"}.{" "}
        ({error.code})
      </>
    );
  }
  if (error.code === "NETWORK") {
    return (
      <>
        We couldn&rsquo;t reach the desk. Check your connection and try again, or call{" "}
        <a href={`tel:${SITE.dispatchPhoneE164}`} className="text-link-strong !text-danger">
          {SITE.dispatchPhone}
        </a>
        . ({error.code})
      </>
    );
  }
  if (error.code === "CATEGORY_DOES_NOT_FIT") {
    return (
      <>
        The aircraft category no longer fits your trip.{" "}
        <Link href="/quote/aircraft" className="text-link-strong !text-danger">
          Pick another category
        </Link>
        . ({error.code})
      </>
    );
  }
  return <>Not sent ({error.code}). Try again, or call dispatch.</>;
}
