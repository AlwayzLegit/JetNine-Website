import { DeskEmpty, DeskHeader, DeskPage, DeskSearch, DeskTabs } from "@/components/admin/desk-ui";
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

  const lead = [
    plural(counts.all, "client"),
    `${counts.recent} flew in the last 90 days`,
    `${counts.card} hold${counts.card === 1 ? "s" : ""} a JetNine Card or Reserve`,
  ].join(" · ");

  const header = (
    <>
      <DeskHeader
        title="Clients"
        lead={lead}
        actions={
          <>
            <DeskSearch
              width={220}
              placeholder="Search a name or email"
              defaultValue={q}
              action="/admin/clients"
              hidden={{ tab: tab === "all" ? undefined : tab }}
            />
            <MemberInviteForm />
          </>
        }
      />
      <DeskTabs
        className="mt-6"
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
        <DeskHeader title="Clients" lead="0 clients" actions={<MemberInviteForm />} />
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
