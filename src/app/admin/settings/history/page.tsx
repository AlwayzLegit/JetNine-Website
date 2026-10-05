import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { HISTORY_TABS, historyTab, listHistory } from "@/domain/history/queries";
import { DeskEmpty, DeskHeader, DeskSearch, DeskTabs } from "@/components/admin/desk-ui";

export const dynamic = "force-dynamic";

type Search = { type?: string; q?: string };
type Props = { searchParams: Promise<Search> };

export default async function HistoryPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = historyTab(sp.type);
  const q = sp.q?.trim() || "";

  const { rows, total } = await listHistory({ type: tab.key, q });

  return (
    <div>
      <DeskHeader size="md"
        title="History"
        lead="Who changed what. Here for the rare day you need it."
        actions={<DeskSearch placeholder="Search actions" defaultValue={q} hidden={{ type: tab.key !== "all" ? tab.key : undefined }} />}
      />

      <DeskTabs
        className="mt-6"
        items={HISTORY_TABS.map((t) => ({ key: t.key, label: t.label }))}
        current={tab.key}
        base="/admin/settings/history"
        param="type"
        keep={{ q: q || undefined }}
      />

      {rows.length === 0 ? (
        <DeskEmpty
          className="mt-6"
          title={q || tab.key !== "all" ? "Nothing matches." : "Nothing recorded yet."}
          body={q || tab.key !== "all" ? "Try another tab or clear the search." : "Every change on the desk lands here as it happens."}
        />
      ) : (
        <>
          <div className="card mt-6 overflow-hidden">
            {rows.map((r) => {
              const s = r.sentence;
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-1 gap-1 border-b border-line-faint px-6 py-3.5 text-[15px] last:border-b-0 md:grid-cols-[150px_minmax(0,1fr)] md:gap-6"
                >
                  <span className="text-steel">{r.when}</span>
                  <span className="min-w-0 text-bone">
                    {s.pre}
                    {s.link ? (
                      <Link href={s.link.href} className="text-link-strong">
                        {s.link.label}
                      </Link>
                    ) : null}
                    {s.post}
                    {s.ref ? <span className="text-[13px] text-steel"> · {s.ref}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[13px] text-steel">
            Showing {rows.length} of {total} {total === 1 ? "entry" : "entries"}
            {rows.length < total ? " · newest first" : ""}
          </p>
        </>
      )}
    </div>
  );
}
