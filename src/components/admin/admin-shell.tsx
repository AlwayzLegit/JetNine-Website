import { BrandMark } from "@/components/brand-mark";
import { AdminNav } from "@/components/admin/admin-nav";
import { signOut } from "@/app/(auth)/sign-in/actions";
import type { CurrentUser } from "@/lib/auth";

export function AdminShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-ink-3 bg-[rgba(7,8,10,0.92)] backdrop-blur-[14px]">
        <div className="container-jn flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <BrandMark size="sm" />
            <span className="rounded-[2px] border border-ink-3 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-clearance">
              Dispatch desk
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2">
              {(user.firstName || user.email.split("@")[0]).toUpperCase()} ·{" "}
              <span className="text-clearance">{user.role.toUpperCase()}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-bone"
              >
                Sign out →
              </button>
            </form>
          </div>
        </div>
        <AdminNav />
      </header>
      <main>{children}</main>
    </div>
  );
}
