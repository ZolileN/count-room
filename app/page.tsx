import Link from "next/link";
import { AsOf } from "@/components/AsOf";
import { DataNotice, Unavailable } from "@/components/DataNotice";
import { Kpi } from "@/components/Kpi";
import { PartyLabel, Swatch } from "@/components/Party";
import { Section } from "@/components/Section";
import { ProgressLine, StackedBar, type Segment } from "@/components/StackedBar";
import { loadNational } from "@/lib/data";
import { fmtAsOf, fmtCompact, fmtInt, fmtPct, fmtTime, pctOf } from "@/lib/format";
import type { PartyResult, ProvinceSummary } from "@/lib/iec/types";
import { OTHER_ID } from "@/lib/iec/types";
import { displayName } from "@/lib/parties";

export const revalidate = 60;

/** Province bar: the Lite file lists the top three parties; everything else is "Rest". */
function provinceSegments(p: ProvinceSummary): Segment[] {
  const listed = p.parties.filter((x) => x.id !== OTHER_ID);
  const rest = Math.max(0, p.totals.valid - listed.reduce((a, x) => a + x.votes, 0));
  return [...listed.map((x) => ({ id: x.id, short: x.short, value: x.votes })), { id: OTHER_ID, short: "Rest", value: rest }];
}

function nationalSegments(parties: PartyResult[]): Segment[] {
  const named = parties.filter((p) => p.id !== OTHER_ID);
  const top = named.slice(0, 8);
  const rest = parties.reduce((a, p) => a + p.votes, 0) - top.reduce((a, p) => a + p.votes, 0);
  return [...top.map((p) => ({ id: p.id, short: p.short, value: p.votes })), { id: OTHER_ID, short: "Other", value: rest }];
}

export default async function CountPage() {
  const r = await loadNational();
  if (!r.ok) return <Unavailable what="Results" />;
  const s = r.value;
  const n = s.data;
  const declared = n.progress.municsComplete;
  const parties = [...n.parties].sort((a, b) => (a.id === OTHER_ID ? 1 : b.id === OTHER_ID ? -1 : b.votes - a.votes));

  return (
    <>
      <DataNotice s={s} />
      <div className="mb-5">
        <h1 className="display text-3xl font-bold sm:text-4xl">The count</h1>
        <p className="mt-1 text-sm text-ink-2">
          Provisional results as the IEC reports them. <AsOf iso={n.reportDate} label="IEC report" />
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Voting districts in"
          value={fmtPct(pctOf(n.progress.vdsComplete, n.progress.vdsExpected), 0)}
          sub={<span className="tally">{fmtInt(n.progress.vdsComplete)} of {fmtInt(n.progress.vdsExpected)}</span>}
        />
        <Kpi label="Councils declared" value={<span className="tally">{declared}</span>} sub={`of ${n.progress.municsExpected}`} />
        <Kpi label="Hung councils" tone="hung" value={<span className="tally">{n.hung}</span>} sub={`of ${declared} declared`} />
        <Kpi label="Majority councils" value={<span className="tally">{n.majority}</span>} sub={`of ${declared} declared`} />
        <Kpi label="Registered voters" value={fmtCompact(n.registered)} sub={<span className="tally">{fmtInt(n.registered)}</span>} />
        <Kpi label="Last IEC update" value={<span className="tally">{fmtTime(n.reportDate)}</span>} sub={fmtAsOf(n.reportDate).split(", ")[1]} />
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Councils are hung when no party holds more than half the seats. Only declared councils are classified.
      </p>

      <Section
        id="national"
        title="National vote"
        asOf={<AsOf iso={n.reportDate} />}
        intro={
          <>
            Share of valid votes counted so far, ward and PR ballots combined, as the IEC reports it. This is the raw count;
            the <Link href="/projection" className="underline">projection</Link> adjusts for provinces that are counting more slowly.
          </>
        }
      >
        <div className="rounded-lg border border-line bg-surface p-3">
          <StackedBar segments={nationalSegments(n.parties)} total={n.totals.valid} label="National vote share" height={18} />
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2" aria-hidden>
            {nationalSegments(n.parties).slice(0, 5).map((x) => (
              <li key={x.id} className="inline-flex items-center gap-1">
                <Swatch id={x.id} className="size-2" />
                {x.short}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">National results by party</caption>
            <thead className="text-left text-xs text-ink-2">
              <tr className="border-b border-line">
                <th scope="col" className="px-3 py-2 font-medium">Party</th>
                <th scope="col" className="px-2 py-2 text-right font-medium sm:px-3">Share</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Votes</th>
                <th scope="col" className="px-2 py-2 text-right font-medium sm:px-3">Seats<span className="hidden sm:inline"> so far</span></th>
                <th scope="col" className="px-2 py-2 text-right font-medium sm:px-3">
                  <abbr title="Councils where the party holds more than half the seats" className="no-underline">
                    <span className="sm:hidden">Maj.</span><span className="hidden sm:inline">Majorities</span>
                  </abbr>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {parties.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="max-w-[10rem] py-2 pl-3 pr-1 text-left font-normal">
                    <PartyLabel id={p.id} short={p.short} title={displayName(p.name, p.id)} />
                    <span className="block truncate pl-4 text-xs text-ink-3">{displayName(p.name, p.id)}</span>
                  </th>
                  <td className="tally px-2 py-2 text-right font-medium sm:px-3">{fmtPct(p.pct, 2)}</td>
                  <td className="tally hidden px-3 py-2 text-right text-ink-2 sm:table-cell">{fmtInt(p.votes)}</td>
                  <td className="tally px-2 py-2 text-right sm:px-3">{fmtInt(p.seats)}</td>
                  <td className="tally py-2 pl-2 pr-3 text-right sm:px-3">{p.id === OTHER_ID ? "–" : (p.majoritiesWon ?? "–")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Seats so far: seats awarded in declared councils plus ward seats already won elsewhere ({fmtInt(n.progress.seatsComplete)} of{" "}
          {fmtInt(n.progress.seatsExpected)}). &ldquo;Other&rdquo; is the IEC&rsquo;s own total for all remaining parties.
        </p>
      </Section>

      <Section id="provinces" title="By province" asOf={<AsOf iso={n.reportDate} />} intro="Vote share in each province (the national file lists the top three parties per province), and the share of voting districts reported.">
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {n.provinces.map((p) => {
            const segs = provinceSegments(p);
            return (
              <li key={p.id} className="px-3 py-3">
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className="text-xs text-ink-2">
                    <span className={p.hung > 0 ? "font-medium text-hung-ink" : ""}>{p.hung} hung</span> · {p.majority} majority ·{" "}
                    {p.progress.municsExpected - p.progress.municsComplete} counting
                  </span>
                </div>
                <StackedBar segments={segs} total={p.totals.valid} label={`${p.name} vote share`} />
                <ul className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-ink-2">
                  {segs.slice(0, 3).map((x) => (
                    <li key={x.id} className="inline-flex items-center gap-1">
                      <Swatch id={x.id} className="size-2" />
                      {x.short} <span className="tally">{fmtPct(pctOf(x.value, p.totals.valid))}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2">
                  <div className="text-xs text-ink-3">Voting districts reported</div>
                  <ProgressLine value={p.progress.vdsComplete} max={p.progress.vdsExpected} label={`${p.name}: voting districts reported`} />
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}
