import { notFound } from "next/navigation";
import { referenceStore } from "@/domain/reference/store";
import { AirportEditForm } from "@/components/admin/airport-edit-form";
import { FboEditor } from "@/components/admin/fbo-editor";
import { DeskCard, DeskHeader, DeskPage, StatusPill } from "@/components/admin/desk-ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminAirportDetailPage({ params }: Props) {
  const { id } = await params;

  const store = referenceStore();
  const airport = await store.airportById(id);
  if (!airport) notFound();

  const fboRows = await store.fbosOf(id);

  const leadParts = [
    airport.iata ? `${airport.icao} / ${airport.iata}` : airport.icao,
    `${airport.city}${airport.region ? `, ${airport.region}` : ""}`,
    airport.countryIso2,
    airport.tz ?? null,
    airport.longestRunwayFt ? `Longest runway ${airport.longestRunwayFt.toLocaleString()} ft` : null,
  ].filter(Boolean);

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/airports", label: "Airports & FBOs" }}
        title={airport.name}
        lead={`${leadParts.join(" · ")}.`}
        actions={
          airport.active ? (
            <StatusPill tone="success">Active</StatusPill>
          ) : (
            <StatusPill tone="steel">Inactive</StatusPill>
          )
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <DeskCard title="Airport details">
          <div className="mt-4">
            <AirportEditForm initial={airport} />
          </div>
        </DeskCard>

        <DeskCard title={`FBOs · ${fboRows.length}`}>
          <div className="mt-4">
            <FboEditor airportId={airport.id} initial={fboRows} />
          </div>
        </DeskCard>
      </div>
    </DeskPage>
  );
}
