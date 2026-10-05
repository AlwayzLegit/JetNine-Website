import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { SITE } from "@/lib/constants";

/**
 * Header for the "Your request" page: white bar with a 1px line under it
 * (the Light chrome), back link left, wordmark centre, dispatch number
 * right. Signed-in members get "← My account"; guests get the homepage.
 */
export function RequestHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface">
      <div className="container-jn grid h-header grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Link
          href={signedIn ? "/account" : "/"}
          className="flex min-h-[44px] items-center whitespace-nowrap text-[15px] text-bone-2 transition-colors hover:text-bone"
        >
          {signedIn ? "← My account" : "← JetNine home"}
        </Link>
        <BrandMark size="sm" className="md:hidden" />
        <BrandMark className="max-md:hidden" />
        <a
          href={`tel:${SITE.dispatchPhoneE164}`}
          className="flex min-h-[44px] items-center justify-end text-right text-[15px] text-bone-2 transition-colors hover:text-bone"
        >
          <span className="max-md:hidden">Questions? Call {SITE.dispatchPhone}</span>
          <span className="md:hidden">Call</span>
        </a>
      </div>
    </header>
  );
}
