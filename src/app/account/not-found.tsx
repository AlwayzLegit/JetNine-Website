import Link from "next/link";

// Portal-styled 404 for account subtrees (e.g. a trip id that isn't yours) —
// the bare default otherwise drops the member out of the account context.
export default function AccountNotFound() {
  return (
    <div className="card p-8 max-md:p-6">
      <p className="eyebrow">Not found</p>
      <h1 className="title-section">Nothing at this address.</h1>
      <p className="mt-4 max-w-[48ch] text-[17px] leading-[1.6] text-bone-2">
        That record doesn&rsquo;t exist or isn&rsquo;t linked to your account. If you expected it here,
        call dispatch and we&rsquo;ll straighten it out.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/account" className="btn btn-primary">
          Back to account <span className="arrow">→</span>
        </Link>
        <Link href="/account/trips" className="btn btn-secondary">
          Your trips
        </Link>
      </div>
    </div>
  );
}
