import type { Metadata } from "next";
import { AsOf } from "@/components/AsOf";
import { CouncilMap } from "@/components/CouncilMap";
import { toMapCouncils } from "@/lib/map-councils";
import { DataNotice, Unavailable } from "@/components/DataNotice";
import { ShareButton } from "@/components/ShareButton";
import { loadNational } from "@/lib/data";

export const revalidate = 60;
export const metadata: Metadata = { title: "Map", description: "Every council on one map: who leads, who has a majority, and which councils are hung." };

export default async function MapPage() {
  const r = await loadNational();
  if (!r.ok) return <Unavailable what="The map" />;
  const n = r.value.data;
  return (
    <>
      <DataNotice s={r.value} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl font-bold sm:text-4xl">Map</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-2">
            Each council coloured by its largest party (declared) or the party leading on votes (still counting). Tap a council to open it.{" "}
            <AsOf iso={n.reportDate} />
          </p>
        </div>
        <ShareButton title="Map of the 2026 local election results" />
      </div>
      <CouncilMap councils={toMapCouncils(n.councils)} provinces={n.provinces.map((p) => ({ id: p.id, name: p.name }))} />
      <p className="mt-3 text-xs text-ink-3">Boundaries: IEC / Municipal Demarcation Board, simplified for display.</p>
    </>
  );
}
