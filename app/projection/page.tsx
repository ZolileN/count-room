import type { Metadata } from "next";
import Link from "next/link";
import { AsOf } from "@/components/AsOf";
import { DataNotice, Unavailable } from "@/components/DataNotice";
import { PartyLabel } from "@/components/Party";
import { AxisRow, RangeRow } from "@/components/RangeRow";
import { Section } from "@/components/Section";
import { loadProjection } from "@/lib/data";
import { fmtCompact, fmtInt, fmtPct, fmtShift } from "@/lib/format";
import { OTHER_ID } from "@/lib/iec/types";
import { displayName } from "@/lib/parties";

export const revalidate = 60;
export const metadata: Metadata = { title: "Projection" };

const niceMax = (v: number, step = 5) => Math.max(step, Math.ceil(v / step) * step);

export default async function ProjectionPage() {
  const r = await loadProjection();
  if (!r.ok) return <Unavailable what="The projection" />;
  const { projection: pr, national, provinces, asOf } = r.value;
  const names = new Map(national.data.parties.map((p) => [p.id, p]));
  const max = niceMax(Math.max(...pr.parties.map((p) => Math.max(p.p95, p.raw, p.projected))));
  const wMax = niceMax(Math.max(...pr.provinces.map((p) => Math.max(p.weightRaw, p.weightProjected))));
  const notice = provinces.stale || provinces.source !== "live" ? provinces : national;

  return (
    <>
      <DataNotice s={notice} />
      <div className="mb-5">
        <h1 className="display text-3xl font-bold sm:text-4xl">Projection</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          Provinces count at different speeds, so the raw national share leans towards the provinces that are furthest
          along. This projection scales each province up to all of its voting districts, keeps its current party shares,
          and adds them back together. The range shows how far that could move if the uncounted districts vote differently
          from the counted ones. It is arithmetic on the count, not a forecast of the final result.{" "}
          <Link href="/method" className="underline">How it works</Link>.
        </p>
        <p className="mt-2">
          <AsOf iso={asOf} label="Province data as of" />
        </p>
      </div>

      <Section id="parties" title="National share: counted vs projected">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="var(--surface)" stroke="var(--ink-2)" strokeWidth="2" /></svg>
            Counted so far
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="var(--ink-2)" /></svg>
            Projected
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="12"><line x1="3" x2="19" y1="6" y2="6" stroke="var(--ink-2)" strokeOpacity="0.35" strokeWidth="8" strokeLinecap="round" /></svg>
            90% range
          </span>
        </div>
        <div className="rounded-lg border border-line bg-surface">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 border-b border-line px-3 py-2 sm:grid-cols-[13rem_minmax(0,1fr)]">
            <div className="hidden text-xs text-ink-2 sm:block">Party · counted → projected</div>
            <AxisRow max={max} />
          </div>
          <ul className="divide-y divide-line">
            {pr.parties.map((p) => {
              const party = names.get(p.id);
              const short = p.id === OTHER_ID ? "Other" : (party?.short ?? String(p.id));
              const label = `${short}: ${fmtPct(p.raw, 2)} counted, ${fmtPct(p.projected, 2)} projected, 90% range ${fmtPct(p.p5)} to ${fmtPct(p.p95)}`;
              return (
                <li key={p.id} className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[13rem_minmax(0,1fr)]">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <PartyLabel id={p.id} short={short} title={displayName(party?.name, p.id)} />
                    <span className="tally whitespace-nowrap text-xs">
                      <span className="text-ink-2">{fmtPct(p.raw)}</span> → <span className="font-semibold text-ink">{fmtPct(p.projected)}</span>{" "}
                      <span className="text-ink-2">({fmtShift(p.shift)})</span>
                    </span>
                  </div>
                  <div>
                    <RangeRow id={p.id} max={max} raw={p.raw} point={p.projected} low={p.p5} high={p.p95} label={label} />
                    <div className="tally text-right text-[11px] text-ink-3">
                      90%: {fmtPct(p.p5)}–{fmtPct(p.p95)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Shift is in percentage points. {fmtInt(pr.sims)} simulations; the same data always gives the same range. For
          parties under about 1%, the range is skewed upwards (see <Link href="/method#projection" className="underline">method</Link>).
        </p>
      </Section>

      <Section
        id="weights"
        title="Projected weight by province"
        intro="Each province's share of national valid votes: counted so far (ring) and projected at full count (dot). Provinces with more districts still to report gain weight."
      >
        <div className="rounded-lg border border-line bg-surface">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 border-b border-line px-3 py-2 sm:grid-cols-[13rem_minmax(0,1fr)]">
            <div className="hidden text-xs text-ink-2 sm:block">Province · districts in</div>
            <AxisRow max={wMax} />
          </div>
          <ul className="divide-y divide-line">
            {pr.provinces.map((p) => (
              <li key={p.id} className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[13rem_minmax(0,1fr)]">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="tally text-xs text-ink-2">
                    {p.noData ? "none yet" : `${fmtPct((1 - p.uncounted) * 100, 0)} in`}
                  </span>
                </div>
                <div>
                  <RangeRow
                    id={OTHER_ID}
                    max={wMax}
                    raw={p.weightRaw}
                    point={p.weightProjected}
                    label={`${p.name}: ${fmtPct(p.weightRaw)} of votes counted so far, ${fmtPct(p.weightProjected)} projected`}
                  />
                  <div className="tally text-right text-[11px] text-ink-3">
                    {fmtPct(p.weightRaw)} → {fmtPct(p.weightProjected)} · {fmtCompact(p.valid)} → {fmtCompact(p.projectedValid)} votes
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Projected valid votes: {fmtCompact(pr.projectedValid)} (counted so far: {fmtCompact(pr.rawValid)}).
          {pr.imputed.length > 0
            ? ` The IEC lists only each province's top 13 parties; for ${new Set(pr.imputed.map((i) => i.partyId)).size} parties we estimated their votes in provinces where they were folded into "Other" (${fmtCompact(pr.imputed.reduce((a, i) => a + i.votes, 0))} votes in all).`
            : ""}
        </p>
      </Section>
    </>
  );
}
