import type { Metadata } from "next";
import { Suspense } from "react";
import { AsOf } from "@/components/AsOf";
import { CouncilList, CouncilRows, type CouncilRow } from "@/components/CouncilList";
import { DataNotice, Unavailable } from "@/components/DataNotice";
import { Kpi } from "@/components/Kpi";
import { loadNational } from "@/lib/data";
import { pctOf } from "@/lib/format";

export const revalidate = 60;
export const metadata: Metadata = { title: "Councils" };

export default async function CouncilsPage() {
  const r = await loadNational();
  if (!r.ok) return <Unavailable what="Council results" />;
  const n = r.value.data;
  const rows: CouncilRow[] = n.councils.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    kind: c.kind,
    provinceId: c.provinceId,
    province: c.province,
    status: c.status,
    drawn: c.drawn,
    totalSeats: c.totalSeats,
    vdsPct: pctOf(c.progress.vdsComplete, c.progress.vdsExpected),
    leader: c.leader ? { id: c.leader.id, short: c.leader.short } : null,
    leaderSeats: c.leaderSeats,
  }));
  const count = (s: CouncilRow["status"]) => rows.filter((c) => c.status === s).length;

  return (
    <>
      <DataNotice s={r.value} />
      <div className="mb-4">
        <h1 className="display text-3xl font-bold sm:text-4xl">Councils</h1>
        <p className="mt-1 text-sm text-ink-2">
          All {rows.length} metropolitan and local councils. A council is hung when, once declared, no party holds more than
          half its seats. <AsOf iso={n.reportDate} />
        </p>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Kpi label="Hung" tone="hung" value={<span className="tally">{count("hung")}</span>} />
        <Kpi label="Majority" value={<span className="tally">{count("majority")}</span>} />
        <Kpi label="Still counting" value={<span className="tally">{count("counting")}</span>} />
      </div>
      <Suspense fallback={<CouncilRows councils={rows} />}>
        <CouncilList councils={rows} provinces={n.provinces.map((p) => ({ id: p.id, name: p.name }))} />
      </Suspense>
      <p className="mt-3 text-xs text-ink-3">
        For councils still counting, the party shown leads on votes so far. Open a council for modelled seats and coalition
        arithmetic.
      </p>
    </>
  );
}
