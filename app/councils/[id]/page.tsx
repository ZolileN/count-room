import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AsOf } from "@/components/AsOf";
import { CoalitionCalculator, type CalcParty } from "@/components/CoalitionCalculator";
import { DataNotice, Unavailable } from "@/components/DataNotice";
import { Hemicycle } from "@/components/Hemicycle";
import { Kpi } from "@/components/Kpi";
import { PartyLabel } from "@/components/Party";
import { Section } from "@/components/Section";
import { ProgressLine } from "@/components/StackedBar";
import { StatusBadge } from "@/components/StatusBadge";
import { WardTable } from "@/components/WardTable";
import { loadCouncil } from "@/lib/data";
import { fmtInt, fmtPct, pctOf } from "@/lib/format";
import { IND_ID } from "@/lib/iec/types";
import { majorityLine } from "@/lib/model/seats";
import { displayName } from "@/lib/parties";

export const revalidate = 60;
export const dynamicParams = true;

export function generateStaticParams(): { id: string }[] {
  return []; // rendered on first request, then cached for 60 s
}

type Props = { params: Promise<{ id: string }> };

async function load(raw: string) {
  if (!/^\d{1,6}$/.test(raw)) return null;
  return loadCouncil(Number(raw));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  if (!r || !r.ok) return { title: "Council" };
  const s = r.value.summary;
  return { title: `${s.name} (${s.code})`, description: `Seats, coalition arithmetic and wards for ${s.name}, 2026 local elections.` };
}

export default async function CouncilPage({ params }: Props) {
  const { id } = await params;
  const r = await load(id);
  if (!r) notFound();
  if (!r.ok) return <Unavailable what="Council results" />;
  const { summary, detail, detailError, national } = r.value;
  const c = detail?.munic.data ?? summary;
  const a = detail?.analysis;
  const majority = majorityLine(c.totalSeats);
  const reportDate = c.reportDate || national.data.reportDate;

  return (
    <>
      <DataNotice s={detail?.munic ?? national} />
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-ink-2">
        <Link href="/councils" className="underline">Councils</Link> <span aria-hidden>/</span> {c.province}
      </nav>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl font-bold sm:text-4xl">{c.name}</h1>
          <p className="text-sm text-ink-2">
            {c.code} · {c.kind === "metro" ? "Metropolitan council" : "Local council"} · {c.totalSeats} seats
          </p>
        </div>
        <StatusBadge status={c.status} drawn={c.drawn} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Voting districts in" value={fmtPct(pctOf(c.progress.vdsComplete, c.progress.vdsExpected), 0)} sub={<span className="tally">{fmtInt(c.progress.vdsComplete)} of {fmtInt(c.progress.vdsExpected)}</span>} />
        <Kpi label="Wards declared" value={<span className="tally">{c.progress.wardsComplete}</span>} sub={`of ${c.progress.wardsExpected}`} />
        <Kpi label="Majority line" value={<span className="tally">{majority}</span>} sub={`of ${c.totalSeats} seats`} />
        <Kpi label="Registered voters" value={<span className="tally">{fmtInt(c.totals.registered)}</span>} />
      </div>
      <p className="mt-2"><AsOf iso={reportDate} label="IEC report" /></p>

      {!detail || !a ? (
        <div className="mt-6 rounded-lg border border-line bg-surface p-4 text-sm">
          <p className="font-medium">{detailError}</p>
          {c.leader ? (
            <p className="mt-2 text-ink-2">
              {c.declared ? "Largest party" : "Leading on votes"}: <PartyLabel id={c.leader.id} short={c.leader.short} />{" "}
              {c.declared ? `with ${c.leaderSeats} of ${c.totalSeats} seats.` : `with ${fmtPct(c.leader.pct)} of votes counted.`}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <Section
            id="seats"
            title={a.seatsSource === "declared" ? "Seats (declared)" : "Seats (modelled while counting)"}
            asOf={<AsOf iso={reportDate} />}
            intro={
              a.seatsSource === "declared" ? (
                "The IEC has declared this council. These are the final seat numbers."
              ) : a.model === "mmp" ? (
                "Modelled with the compensatory formula from the Municipal Structures Act (Schedule 1) on the votes counted so far, using ward seats already won. Ranges show the 90% spread across simulations of the uncounted vote. Replaced by the IEC's seats once the council is declared."
              ) : (
                "An approximation: PR-ballot votes counted so far, shared out by Droop quota and largest remainders. The IEC's real formula is compensatory (ward seats first, PR seats top up to proportionality, overhang possible), so this can be a seat or so out. Ranges show the 90% spread across simulations of the uncounted vote. Replaced by the IEC's seats once the council is declared."
              )
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-line bg-surface p-3">
                <Hemicycle groups={a.rows} total={a.totalSeats} majority={a.majority} caption={`${c.name} seat chart`} />
              </div>
              <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full text-sm">
                  <caption className="sr-only">Seats by party</caption>
                  <thead className="text-left text-xs text-ink-2">
                    <tr className="border-b border-line">
                      <th scope="col" className="px-3 py-2 font-medium">Party</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium sm:px-3">Votes</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium sm:px-3">Wards</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium sm:px-3">Seats</th>
                      {a.seatsSource === "model" ? <th scope="col" className="px-2 py-2 text-right font-medium sm:px-3">90%</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {a.rows.filter((p) => p.seats > 0).map((p) => (
                      <tr key={p.id}>
                        <th scope="row" className="max-w-[10rem] px-2 py-1.5 sm:px-3 text-left font-normal">
                          <PartyLabel id={p.id} short={p.short} title={displayName(p.name, p.id)} />
                        </th>
                        <td className="tally px-2 py-1.5 sm:px-3 text-right text-ink-2">{fmtPct(p.pct)}</td>
                        <td className="tally px-2 py-1.5 sm:px-3 text-right text-ink-2">{p.wardSeats}</td>
                        <td className="tally px-2 py-1.5 sm:px-3 text-right font-semibold">{p.seats}</td>
                        {a.seatsSource === "model" ? (
                          <td className="tally whitespace-nowrap px-2 py-1.5 text-right text-ink-2 sm:px-3">{p.low === p.high ? p.low : `${p.low}–${p.high}`}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {a.rows.some((p) => p.seats === 0) ? (
                  <p className="border-t border-line px-3 py-2 text-xs text-ink-3">
                    {a.rows.filter((p) => p.seats === 0).length} more parties have no modelled seat
                    {a.rows.some((p) => p.seats === 0 && p.high > 0) ? " (some reach one seat in the 90% range: " + a.rows.filter((p) => p.seats === 0 && p.high > 0).map((p) => p.short).join(", ") + ")" : ""}.
                  </p>
                ) : null}
              </div>
            </div>
          </Section>

          <Section id="coalitions" title="Coalition calculator" asOf={<AsOf iso={reportDate} />}>
            <CoalitionCalculator
              parties={a.rows.filter((p) => p.seats > 0).map((p): CalcParty => ({ id: p.id, short: p.short, name: displayName(p.name, p.id), seats: p.seats, low: p.low, high: p.high, isIndependent: p.id === IND_ID }))}
              totalSeats={a.totalSeats}
              majority={a.majority}
              coalitions={a.coalitions}
              declared={a.seatsSource === "declared"}
              sims={a.sims}
            />
          </Section>

          <Section id="wards" title={`Wards (${detail.munic.data.wards.length})`} asOf={<AsOf iso={reportDate} />} intro="Ward-ballot results. Margin is the gap between the first two candidates as a share of valid ward votes.">
            <div className="mb-3">
              <div className="text-xs text-ink-3">Wards declared</div>
              <ProgressLine value={c.progress.wardsComplete} max={c.progress.wardsExpected} label="Wards declared" />
            </div>
            <WardTable wards={detail.munic.data.wards} />
          </Section>
        </>
      )}
    </>
  );
}
