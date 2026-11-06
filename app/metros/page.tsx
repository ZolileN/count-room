import type { Metadata } from "next";
import Link from "next/link";
import { AsOf } from "@/components/AsOf";
import { DataNotice, Unavailable } from "@/components/DataNotice";
import { Hemicycle } from "@/components/Hemicycle";
import { PartyLabel } from "@/components/Party";
import { ProgressLine } from "@/components/StackedBar";
import { StatusBadge } from "@/components/StatusBadge";
import { loadMetros } from "@/lib/data";
import { fmtPct } from "@/lib/format";

export const revalidate = 60;
export const metadata: Metadata = { title: "Metros" };

function pctLabel(p: number) {
  return p >= 0.995 ? ">99%" : p > 0 && p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`;
}

export default async function MetrosPage() {
  const r = await loadMetros();
  if (!r.ok) return <Unavailable what="Metro results" />;
  const { national, metros } = r.value;

  return (
    <>
      <DataNotice s={national} />
      <div className="mb-5">
        <h1 className="display text-3xl font-bold sm:text-4xl">Metros</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-2">
          The eight metropolitan councils at a glance. While a metro is still counting its seats are modelled from the votes
          so far; the two-party combinations listed are seat arithmetic, not predictions of who will govern.
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {metros.map(({ summary: s, analysis: a, fetchedAt }) => {
          const two = a?.coalitions.filter((c) => c.members.length <= 2).slice(0, 3) ?? [];
          const name = (id: number) => a?.rows.find((x) => x.id === id)?.short ?? String(id);
          return (
            <li key={s.id} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="display text-xl font-bold">
                    <Link href={`/councils/${s.id}`} className="hover:underline">{s.name}</Link>
                  </h2>
                  <p className="text-xs text-ink-3">{s.code} · {s.province} · {s.totalSeats} seats</p>
                </div>
                <StatusBadge status={s.status} drawn={s.drawn} />
              </div>
              <div className="mt-2">
                <div className="text-xs text-ink-3">Voting districts reported</div>
                <ProgressLine value={s.progress.vdsComplete} max={s.progress.vdsExpected} label={`${s.name}: voting districts reported`} />
              </div>
              {a ? (
                <>
                  <div className="mx-auto mt-2 max-w-xs">
                    <Hemicycle groups={a.rows} total={a.totalSeats} majority={a.majority} caption={`${s.name} ${a.seatsSource === "declared" ? "declared" : "modelled"} seats`} />
                  </div>
                  <p className="text-center text-xs text-ink-3">{a.seatsSource === "declared" ? "Declared seats" : "Modelled seats while counting"}</p>
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {a.rows.slice(0, 5).map((p) => (
                      <li key={p.id} className="inline-flex items-center gap-1">
                        <PartyLabel id={p.id} short={p.short} />
                        <span className="tally text-ink-2">
                          {p.seats}
                          {a.seatsSource === "model" && p.low !== p.high ? ` (${p.low}–${p.high})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 border-t border-line pt-2 text-sm">
                    <div className="text-xs text-ink-2">Two-party seat totals at or over {a.majority}</div>
                    {two.length === 0 ? (
                      <p className="text-ink-2">None: any majority needs three or more parties.</p>
                    ) : (
                      <ul>
                        {two.map((c) => (
                          <li key={c.members.join("-")} className="flex justify-between gap-2">
                            <span>{c.members.map(name).join(" + ")}</span>
                            <span className="tally text-ink-2">
                              {c.seats}
                              {a.seatsSource === "model" ? ` · ${pctLabel(c.probability)} of sims` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <p className="mt-2"><AsOf iso={s.reportDate || fetchedAt} /></p>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink-2">
                  {s.leader ? <>Leading on votes: <PartyLabel id={s.leader.id} short={s.leader.short} /> {fmtPct(s.leader.pct)}. </> : null}
                  Detailed results are unavailable just now.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
