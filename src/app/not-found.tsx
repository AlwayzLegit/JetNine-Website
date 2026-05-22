import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-jn flex min-h-[70vh] items-center py-16">
      <div className="mx-auto max-w-[640px] text-center">
        <p className="caption mb-6">— Status · 404</p>
        <h1 className="display-l">Off the flight plan.</h1>
        <p className="mx-auto mt-6 max-w-[52ch] text-[15px] leading-[1.65] text-bone-2">
          We couldn&rsquo;t find that page. It may have been moved, renamed, or
          never existed. Head back to the homepage or start a quote — dispatch
          will route you from there.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="btn btn-primary">
            Back to home <span className="arrow">→</span>
          </Link>
          <Link href="/quote/mission" className="btn btn-secondary">
            Start a quote
          </Link>
        </div>
      </div>
    </main>
  );
}
