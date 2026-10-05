import { requireAdmin } from "@/lib/auth";
import { DESK_ROLE_WORDS } from "@/lib/desk-status";
import { listTeam } from "@/domain/settings/queries";
import { DESK_PANEL, DeskRow } from "@/components/admin/desk-ui";
import { TeamHeader, TeamRowChange } from "@/components/admin/settings/team-forms";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await requireAdmin();

  const rows = await listTeam();

  return (
    <div>
      <TeamHeader />

      <div className={`${DESK_PANEL} mt-4 overflow-hidden`}>
        {rows.map((r) => {
          const role = r.deskRole;
          const words = DESK_ROLE_WORDS[role];
          const name = r.name;
          const isMe = r.id === me.id;
          const locked = r.role === "superadmin";
          return (
            <DeskRow key={r.id} cols="md:grid-cols-[36px_minmax(0,1fr)_220px_auto]" className="md:!gap-3.5 md:!py-3">
              <span aria-hidden="true" className="hidden h-[34px] w-[34px] items-center justify-center rounded-full bg-[#ECE3D6] font-serif text-[15px] text-gold md:flex">
                {(name.trim()[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-bold text-bone">
                  {name}
                  {isMe ? <span className="text-steel"> · you</span> : null}
                </div>
                <div className="truncate text-[12px] text-steel">{r.email}</div>
              </div>
              <div>
                <div className="text-[14px] text-bone">{words.label}</div>
                <div className="text-[12px] text-steel">{words.can}</div>
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

      <p className="mt-3 text-[14px] text-steel">
        Two roles only. <strong className="font-medium text-bone-2">Owner</strong> sees everything including reports and
        money. <strong className="font-medium text-bone-2">Team</strong> handles requests, trips and clients.
      </p>
    </div>
  );
}
