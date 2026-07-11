import Link from "next/link";

// Portal-styled 404 for account subtrees (e.g. a trip id that isn't yours) —
// the bare default otherwise drops the member out of the account context.
export default function AccountNotFound() {
  return (
    <section className="container-jn py-24 text-center">
      <p className="caption mb-4">— Account · not found</p>
      <h1 className="font-serif text-[36px] font-light leading-tight tracking-tight text-bone">
        Nothing at this address.
      </h1>
      <p className="mx-auto mt-4 max-w-[48ch] text-[15px] leading-[1.6] text-bone-2">
        That record doesn&rsquo;t exist or isn&rsquo;t linked to your account. If you expected it
        here, call dispatch and we&rsquo;ll straighten it out.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link href="/account" className="btn btn-primary btn-sm">
          Back to account <span className="arrow">→</span>
        </Link>
        <Link href="/account/trips" className="btn btn-ghost btn-sm">
          Your trips
        </Link>
      </div>
    </section>
  );
}
