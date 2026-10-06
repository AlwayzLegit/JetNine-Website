import { requireStaff } from "@/lib/auth";
import { DeskHeader, DeskRow } from "@/components/admin/desk-ui";
import { referenceCounts } from "@/domain/reference/queries";

export const dynamic = "force-dynamic";

function countWords(n: number | undefined, one: string, many = `${one}s`): string | null {
  if (typeof n !== "number") return null;
  return `${n} ${n === 1 ? one : many}`;
}

export default async function ReferenceDataPage() {
  await requireStaff();
  const c = await referenceCounts();

  const items: { href: string; title: string; desc: string; count: string | null }[] = [
    {
      href: "/admin/operators",
      title: "Operators",
      desc: "The Part 135 carriers we book with, their vetting and who to call",
      count: countWords(c.operators, "operator"),
    },
    {
      href: "/admin/aircraft",
      title: "Aircraft",
      desc: "Tails we know, with seats, range and status",
      count: countWords(c.aircraft, "aircraft", "aircraft"),
    },
    {
      href: "/admin/airports",
      title: "Airports & FBOs",
      desc: "Where flights leave from and the handlers on the ground",
      count:
        typeof c.airports === "number"
          ? `${countWords(c.airports, "airport")}${typeof c.fbos === "number" ? ` · ${countWords(c.fbos, "FBO")}` : ""}`
          : null,
    },
    {
      href: "/admin/ops",
      title: "Live ops board",
      desc: "Today's aircraft, crews and blocked time at a glance",
      count: null,
    },
    {
      href: "/admin/empty-leg",
      title: "Empty legs",
      desc: "Repositioning flights on sale and the people watching for them",
      count: countWords(c.empty_legs, "leg on the board", "legs on the board"),
    },
    {
      href: "/admin/settings/ai",
      title: "AI providers",
      desc: "Which model answers the phone after hours",
      count: countWords(c.ai_providers, "key in use", "keys in use"),
    },
  ];

  return (
    <div>
      <DeskHeader size="md"
        title="Reference data"
        lead="The tables behind the empty-leg board and quote matching. Avinode replaces most of this over time."
      />

      <div className="card mt-6 overflow-hidden">
        {items.map((i) => (
          <DeskRow key={i.href} href={i.href} cols="md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <div className="min-w-0">
              <div className="text-[16px] font-medium text-bone">{i.title}</div>
              <div className="text-[14px] text-steel">{i.desc}</div>
            </div>
            <div className="text-[14px] text-bone-2">{i.count ?? ""}</div>
            <span className="text-[14px] text-steel" aria-hidden="true">
              Open ›
            </span>
          </DeskRow>
        ))}
      </div>
    </div>
  );
}
