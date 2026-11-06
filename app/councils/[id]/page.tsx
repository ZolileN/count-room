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
import { ShareButton } from "@/components/ShareButton";
import { WardMap, type WardMapWard } from "@/components/WardMap";
import { biggestSwings, closeWards } from "@/lib/model/swing";
import { fmtShift } from "@/lib/format";
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
  const { summary, detail, detailError, national, previous, swing, wardMap } = r.value;
  const c = detail?.munic.data ?? summary;
  const a = detail?.analysis;
  const majority = majorityLine(c.totalSeats);
  const reportDate = c.reportDate || national.data.reportDate;
  const mapParties = (a?.rows ?? []).filter((p) => p.id !== IND_ID).slice(0, 8).map((p) => ({ id: p.id, short: p.short }));

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
        <div className="flex items-center gap-2">
          <StatusBadge status={c.status} drawn={c.drawn} />
          <ShareButton title={`${c.name}: 2026 local election results, seats and coalition maths`} />
        </div>
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

          {process.env.ANTHROPIC_API_KEY ? (
            <p className="mt-6 text-sm">
              <Link href={`/ask?council=${c.id}`} className="underline">Ask a question about {c.name}</Link>
            </p>
          ) : null}

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

          {wardMap ? (
            <Section id="map" title="Ward map" asOf={<AsOf iso={reportDate} />}>
              <WardMap
                wards={detail.munic.data.wards.map((w): WardMapWard => {
                  const cmp = swing?.wards.find((x) => x.wardId === w.id);
                  const lead = w.parties[0];
                  const second = w.parties[1];
                  return {
                    id: w.id,
                    number: w.number,
                    declared: w.declared,
                    leader: lead ? { id: lead.id, short: lead.short, ...(lead.candidate ? { candidate: lead.candidate } : {}) } : null,
                    marginPct: lead && w.valid > 0 ? ((lead.votes - (second?.votes ?? 0)) / w.valid) * 100 : null,
                    swing: cmp && cmp.matchedVds > 0 ? Object.fromEntries(mapParties.map((p) => [p.id, cmp.swing[p.id] ?? 0])) : null,
                    coverage: cmp?.coverage ?? 0,
                  };
                })}
                parties={mapParties}
                councilId={c.id}
                councilName={c.name}
                hasSwing={!!swing}
              />
            </Section>
          ) : null}

          {swing && previous ? (
            <Section
              id="change"
              title="Change since 2021"
              asOf={<AsOf iso={reportDate} />}
              intro={`Ward boundaries were redrawn for 2026, so we compare the same voting districts in both years: the ${swing.overall.matchedVds} districts counted so far that also existed in 2021 (${Math.round(swing.overall.coverage * 100)}% of the votes counted). Shares are of all valid votes, ward and PR ballots together.`}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Party shares on matched voting districts, 2021 and 2026</caption>
                    <thead className="text-left text-xs text-ink-2">
                      <tr className="border-b border-line">
                        <th scope="col" className="px-3 py-2 font-medium">Party</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">2021</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">2026</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {Object.keys({ ...swing.overall.now, ...swing.overall.then })
                        .map(Number)
                        .map((id) => ({ id, now: swing.overall.now[id] ?? 0, then: swing.overall.then[id] ?? 0, d: swing.overall.swing[id] ?? 0 }))
                        .filter((x) => x.now >= 1 || x.then >= 1)
                        .sort((x, y) => y.now - x.now)
                        .slice(0, 10)
                        .map((x) => (
                          <tr key={x.id}>
                            <th scope="row" className="px-3 py-1.5 text-left font-normal">
                              <PartyLabel id={x.id} short={detail.munic.data.parties.find((q) => q.id === x.id)?.short ?? previous.parties.find((q) => q.id === x.id)?.short ?? String(x.id)} />
                            </th>
                            <td className="tally px-3 py-1.5 text-right text-ink-2">{x.then > 0 ? fmtPct(x.then) : "–"}</td>
                            <td className="tally px-3 py-1.5 text-right">{fmtPct(x.now)}</td>
                            <td className="tally px-3 py-1.5 text-right font-semibold">{x.then > 0 ? fmtShift(x.d) : "new"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Biggest ward swings</h3>
                  <ol className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
                    {biggestSwings(swing.wards, a.rows.filter((p) => p.id !== IND_ID).slice(0, 6).map((p) => p.id), { n: 8 }).map((e) => (
                      <li key={`${e.wardId}-${e.partyId}`}>
                        <Link href={`/councils/${c.id}/wards/${e.number}`} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2">
                          <span className="tally w-16 shrink-0 text-ink-2">Ward {e.number}</span>
                          <PartyLabel id={e.partyId} short={a.rows.find((q) => q.id === e.partyId)?.short ?? String(e.partyId)} className="flex-1" />
                          <span className="tally text-xs text-ink-2">{fmtPct(e.then)} → {fmtPct(e.now)}</span>
                          <span className="tally w-12 text-right font-semibold">{fmtShift(e.swing)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-xs text-ink-3">
                    2021 council result: {previous.parties.filter((q) => q.seats > 0).slice(0, 5).map((q) => `${q.short} ${q.seats}`).join(", ")} of {previous.totalSeats} seats.
                  </p>
                </div>
              </div>
            </Section>
          ) : null}

          {(() => {
            const close = closeWards(detail.munic.data.wards, 5).slice(0, 10);
            if (close.length === 0) return null;
            const sh = (id: number) => a.rows.find((q) => q.id === id)?.short ?? detail.munic.data.parties.find((q) => q.id === id)?.short ?? String(id);
            return (
              <Section id="close" title="Closest wards" asOf={<AsOf iso={reportDate} />} intro="Wards decided or led by less than 5 points on the ward ballot, and how many more votes the runner-up needed.">
                <ol className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
                  {close.map((x) => (
                    <li key={x.ward.id}>
                      <Link href={`/councils/${c.id}/wards/${x.ward.number}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-surface-2">
                        <span className="tally w-16 shrink-0 font-medium">Ward {x.ward.number}</span>
                        <span className="flex flex-1 items-center gap-1.5">
                          <PartyLabel id={x.leaderId} short={sh(x.leaderId)} /> <span className="text-ink-3">{x.ward.declared ? "won, ahead of" : "leads"}</span>{" "}
                          <PartyLabel id={x.runnerUpId} short={sh(x.runnerUpId)} />
                        </span>
                        <span className="tally text-xs text-ink-2">
                          by {fmtInt(x.margin)} ({fmtPct(x.marginPct)}) · needed {fmtInt(x.additional)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </Section>
            );
          })()}

          <Section id="wards" title={`Wards (${detail.munic.data.wards.length})`} asOf={<AsOf iso={reportDate} />} intro="Ward-ballot results. Margin is the gap between the first two candidates as a share of valid ward votes.">
            <div className="mb-3">
              <div className="text-xs text-ink-3">Wards declared</div>
              <ProgressLine value={c.progress.wardsComplete} max={c.progress.wardsExpected} label="Wards declared" />
            </div>
            <WardTable wards={detail.munic.data.wards} councilId={c.id} />
          </Section>
        </>
      )}
    </>
  );
}
