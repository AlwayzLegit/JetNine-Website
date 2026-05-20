import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="container-jn flex items-center justify-between py-6">
        <Link href="/" className="flex items-baseline gap-1.5 font-serif text-[22px] font-normal tracking-tight">
          JetNine
          <span className="font-mono text-[11px] tracking-[0.12em] text-clearance border border-ink-4 rounded-[2px] px-1.5 py-[3px]">
            09
          </span>
        </Link>
        <nav className="hidden lg:flex gap-8">
          {[
            ["Aircraft", "/aircraft"],
            ["Memberships", "/memberships"],
            ["Empty legs", "/empty-legs"],
            ["About", "/about"],
            ["Contact", "/contact"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/quote" className="btn btn-primary btn-sm">
          Request a quote <span className="arrow">→</span>
        </Link>
      </header>

      <section className="container-jn py-32">
        <p className="caption mb-6 inline-flex items-center gap-3">
          <span className="block h-px w-8 bg-clearance" />
          JetNine · v0.9 redesign · build phase 1
        </p>
        <h1 className="display-xl max-w-[18ch]">
          Ready when
          <br />
          you are.
        </h1>
        <p className="body-l mt-7 max-w-[60ch]">
          Scaffolding is up. Design tokens loaded. Fonts mounted. The next 30 screens land in the
          coming sessions — marketing, the four-step quote flow, the member account, and the
          dispatcher desk.
        </p>

        <div className="mt-16 grid grid-cols-2 gap-8 border-t border-ink-3 pt-8 sm:grid-cols-4">
          {[
            ["— PUBLIC PAGES", "17", "Marketing + quote"],
            ["— MEMBER ACCOUNT", "5", "Logged-in shell"],
            ["— ADMIN / DISPATCH", "9", "Operational tools"],
            ["— DESIGN SYSTEM", "v0.1", "Tokens · components"],
          ].map(([label, value, sub]) => (
            <div key={label}>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{label}</div>
              <div className="font-serif text-[44px] font-light leading-none tracking-tight text-bone mt-2">
                {value}
              </div>
              <div className="font-mono text-[10px] tracking-[0.04em] text-bone-2 mt-1.5">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="container-jn border-t border-ink-3 py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-steel">
            © 2026 JetNine · Part 295 indirect air carrier
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-steel">
            Build: phase 1 · scaffold
          </p>
        </div>
      </footer>
    </main>
  );
}
