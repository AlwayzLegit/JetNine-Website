import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/(auth)/sign-in/actions";

type Props = {
  searchParams: Promise<{ denied?: string }>;
};

export default async function AccountPage({ searchParams }: Props) {
  const { denied } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const isStaff = ["dispatcher", "admin", "superadmin"].includes(user.role);

  return (
    <section className="container-jn py-12">
      {denied === "admin" ? (
        <div className="mb-10 rounded-[3px] border border-[var(--error)] bg-[rgba(164,69,58,0.08)] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--error)]">
            — Access denied · dispatch desk
          </p>
          <p className="mt-2 text-[14px] leading-[1.5] text-bone-2">
            Your account doesn&rsquo;t have dispatcher or admin role. Contact your account owner or
            email{" "}
            <a href="mailto:dispatch@jetnine.com" className="text-clearance">
              dispatch@jetnine.com
            </a>{" "}
            if this is unexpected.
          </p>
        </div>
      ) : null}

      <header className="mb-12">
        <p className="caption mb-4">— Member account</p>
        <h1 className="font-serif text-[44px] font-light leading-tight tracking-tight text-bone">
          Welcome back, {user.firstName || user.email.split("@")[0]}.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.55] text-bone-2">
          Signed in as <span className="font-mono text-[13px] text-clearance">{user.email}</span>{" "}
          with role <span className="font-mono text-[13px] text-clearance">{user.role}</span>.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Trips", href: "/account/trips", desc: "Past, upcoming, in-flight." },
          { label: "Invoices", href: "/account/invoices", desc: "Outstanding & paid." },
          { label: "Preferences", href: "/account/preferences", desc: "Cabin, catering, ground." },
          { label: "Membership", href: "/account/members", desc: "Tier, balance, activity." },
          { label: "Request a quote", href: "/quote", desc: "Start the four-step wizard." },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-col gap-2 rounded-[4px] border border-ink-3 bg-ink-2 p-7 transition-all duration-200 ease-out-quint hover:-translate-y-0.5 hover:border-clearance"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — {t.label}
            </span>
            <span className="font-serif text-[20px] font-normal leading-[1.2] tracking-tight text-bone">
              {t.desc}
            </span>
          </Link>
        ))}

        {isStaff ? (
          <Link
            href="/admin/dispatch"
            className="flex flex-col gap-2 rounded-[4px] border border-clearance bg-[rgba(232,226,210,0.04)] p-7 transition-all duration-200 ease-out-quint hover:-translate-y-0.5"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
              — Dispatch desk
            </span>
            <span className="font-serif text-[20px] font-normal leading-[1.2] tracking-tight text-bone">
              Open the inbox →
            </span>
          </Link>
        ) : null}
      </div>

      <form action={signOut} className="mt-16 border-t border-ink-3 pt-8">
        <button
          type="submit"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
        >
          Sign out →
        </button>
      </form>
    </section>
  );
}
