import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { requireAdmin } from "@/lib/auth";
import { deskRole, DESK_ROLE_WORDS, personName } from "@/lib/desk-status";
import { DeskRow } from "@/components/admin/desk-ui";
import { TeamHeader, TeamRowChange } from "@/components/admin/settings/team-forms";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await requireAdmin();

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      displayName: staff.displayName,
    })
    .from(users)
    .leftJoin(staff, eq(staff.userId, users.id))
    .where(inArray(users.role, ["dispatcher", "admin", "superadmin"]))
    .orderBy(
      // Owners first, then by name.
      sql`case when ${users.role} in ('admin','superadmin') then 0 else 1 end`,
      asc(staff.displayName),
      asc(users.lastName),
      asc(users.firstName),
    );

  return (
    <div>
      <TeamHeader />

      <div className="card mt-6 overflow-hidden">
        {rows.map((r) => {
          const role = deskRole(r.role);
          if (!role) return null;
          const words = DESK_ROLE_WORDS[role];
          const name = r.displayName?.trim() || personName(r.firstName, r.lastName, r.email.split("@")[0]);
          const isMe = r.id === me.id;
          const locked = r.role === "superadmin";
          return (
            <DeskRow key={r.id} cols="md:grid-cols-[minmax(0,1fr)_220px_auto]">
              <div className="min-w-0">
                <div className="truncate text-[16px] font-medium text-bone">
                  {name}
                  {isMe ? <span className="text-steel"> · you</span> : null}
                </div>
                <div className="truncate text-[14px] text-steel">{r.email}</div>
              </div>
              <div>
                <div className="text-[15px] text-bone">{words.label}</div>
                <div className="text-[14px] text-steel">{words.can}</div>
              </div>
              {isMe ? (
                <span className="text-[14px] text-steel">Ask another owner to change you</span>
              ) : locked ? (
                <span className="text-[14px] text-steel">Account owner</span>
              ) : (
                <TeamRowChange userId={r.id} role={role} name={name} />
              )}
            </DeskRow>
          );
        })}
      </div>

      <p className="mt-4 text-[14px] text-steel">
        Two roles only. <strong className="font-medium text-bone-2">Owner</strong> sees everything including reports and
        money. <strong className="font-medium text-bone-2">Team</strong> handles requests, trips and clients.
      </p>
    </div>
  );
}
