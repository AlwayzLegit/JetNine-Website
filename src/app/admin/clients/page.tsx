import { DESK_PANEL, DeskEmpty, DeskHeader, DeskPage, DeskSearch, DeskTabs } from "@/components/admin/desk-ui";
import { MemberInviteForm } from "@/components/admin/member-invite-form";
import { ClientsTable } from "@/components/admin/clients/clients-table";
import { listClients, type ClientTab } from "@/domain/clients/queries";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; tab?: string }> };

const TABS: { key: ClientTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "recent", label: "Flew recently" },
  { key: "card", label: "Card members" },
  { key: "new", label: "New" },
];

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AdminClientsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { tab, q, total, counts, clients } = await listClients({ tab: sp.tab, q: sp.q });
  const visible = clients.map((c) => c.row);

  const lead = "Everyone who has asked for a quote or flown with JetNine.";
  const stats: [number, string][] = [
    [counts.all, counts.all === 1 ? "client" : "clients"],
    [counts.recent, "flew in the last 90 days"],
    [counts.card, counts.card === 1 ? "holds a JetNine Card or Reserve" : "hold a JetNine Card or Reserve"],
  ];

  const header = (
    <>
      <DeskHeader
        title="Clients"
        lead={lead}
        actions={
          <>
            <DeskSearch
              width={200}
              placeholder="Search a name or email"
              defaultValue={q}
              action="/admin/clients"
              hidden={{ tab: tab === "all" ? undefined : tab }}
            />
            <MemberInviteForm />
          </>
        }
      />
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2.5">
        {stats.map(([v, k]) => (
          <div key={k} className={`${DESK_PANEL} min-w-0 px-3 py-3 sm:px-3.5`}>
            <div className="font-serif text-[26px] leading-none text-bone">{v}</div>
            <div className="mt-1 text-[12px] leading-[1.35] text-steel sm:text-[13px]">{k}</div>
          </div>
        ))}
      </div>
      <DeskTabs
        className="mt-4"
        base="/admin/clients"
        current={tab}
        keep={{ q: q || undefined }}
        items={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] }))}
      />
    </>
  );

  // No clients at all (and no search narrowing things): the empty desk.
  if (total === 0 && !q) {
    return (
      <DeskPage>
        <DeskHeader title="Clients" lead={plural(0, "client")} actions={<MemberInviteForm />} />
        <DeskEmpty title="No clients yet." body="Invite the first one, or they appear when someone books." />
      </DeskPage>
    );
  }

  return (
    <DeskPage>
      <ClientsTable
        rows={visible}
        header={header}
        emptyTitle={q ? "No one matches." : "Nobody here yet."}
        emptyBody={q ? "Try another name or email, or clear the search." : "Clients land in this tab as they fly."}
      />
    </DeskPage>
  );
}
