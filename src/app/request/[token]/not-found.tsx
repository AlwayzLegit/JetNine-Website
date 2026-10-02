import Link from "next/link";
import { RequestHeader } from "@/components/request/request-header";
import { SITE } from "@/lib/constants";

export default function RequestNotFound() {
  return (
    <>
      <RequestHeader signedIn={false} />
      <main id="main-content" className="container-jn py-24 text-center">
        <p className="eyebrow">Your request</p>
        <h1 className="title-section mx-auto max-w-[20ch]">We can&rsquo;t find that request.</h1>
        <p className="mx-auto mt-4 max-w-[48ch] text-[17px] leading-[1.6] text-bone-2">
          The link may be incomplete, or the request was made under a different link. Call dispatch
          with your name and route and we&rsquo;ll find it in a minute.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-primary btn-lg">
            Call {SITE.dispatchPhone}
          </a>
          <Link href="/quote/mission" className="btn btn-secondary btn-lg">
            Start a new request
          </Link>
        </div>
      </main>
    </>
  );
}
