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
    <section className="card mt-6 border-clearance p-8 max-md:p-5">
      <h2 className="font-serif text-[32px] font-light leading-[1.15] text-bone">
        Send it to dispatch.
      </h2>
      <p className="mt-3 max-w-[72ch] text-[15px] text-bone-2">
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
        className="btn btn-primary btn-xl mt-6 !text-[17px] max-md:w-full"
      >
        {submitting ? "Sending…" : "Submit quote request"}{" "}
        <span className="arrow" aria-hidden>
          →
        </span>
      </button>
      {error ? (
        <p className="mt-4 text-[15px] text-danger" role="alert">
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
  return <>Not sent ({error.code}). Try again, or call dispatch.</>;
}
