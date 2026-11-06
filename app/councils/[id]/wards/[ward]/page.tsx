import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AsOf } from "@/components/AsOf";
import { DataNotice, Unavailable } from "@/components/DataNotice";
import { Kpi } from "@/components/Kpi";
import { PartyLabel, Swatch } from "@/components/Party";
import { Section } from "@/components/Section";
import { ShareButton } from "@/components/ShareButton";
import { loadWard } from "@/lib/data";
import { fmtInt, fmtPct, fmtShift, pctOf } from "@/lib/format";
import { compareWard, votesNeeded } from "@/lib/model/swing";
import { displayName, titleCase } from "@/lib/parties";

export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams(): { id: string; ward: string }[] {
  return [];
}

type Props = { params: Promise<{ id: string; ward: string }> };

async function load(p: { id: string; ward: string }) {
  if (!/^\d{1,6}$/.test(p.id) || !/^\d{1,3}$/.test(p.ward)) return null;
  return loadWard(Number(p.id), Number(p.ward));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load(await params);
  if (!r || !r.ok) return { title: "Ward" };
  const { council, ward } = r.value;
  const lead = ward.parties[0];
  return {
    title: `Ward ${ward.number}, ${council.name}`,
    description: lead
      ? `${lead.short} ${ward.declared ? "won" : "leads"} ward ${ward.number} in ${council.name}. Live 2026 local election results.`
      : `Ward ${ward.number} in ${council.name}: live 2026 local election results.`,
  };
}

export default async function WardPage({ params }: Props) {
  const p = await params;
  const r = await load(p);
  if (!r) notFound();
  if (!r.ok) return <Unavailable what="Ward results" />;
  const { council, ward, previous, councilSource } = r.value;
  const vn = votesNeeded(ward);
  const cmp = previous ? compareWard(ward, previous) : null;
  const shortOf = new Map(council.parties.map((x) => [x.id, x.short]));
  const nameOf = new Map(council.parties.map((x) => [x.id, displayName(x.name, x.id)]));
  const prevShort = new Map(previous?.parties.map((x) => [x.id, x.short]) ?? []);
  const swingRows = cmp
    ? Object.keys({ ...cmp.now, ...cmp.then })
        .map(Number)
        .map((id) => ({ id, now: cmp.now[id] ?? 0, then: cmp.then[id] ?? 0, swing: cmp.swing[id] ?? 0 }))
        .filter((x) => x.now >= 1 || x.then >= 1)
        .sort((a, b) => b.now - a.now)
    : [];

  return (
    <>
      <DataNotice s={councilSource} />
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-ink-2">
        <Link href="/councils" className="underline">Councils</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/councils/${council.id}`} className="underline">{council.name}</Link> <span aria-hidden>/</span> Ward {ward.number}
      </nav>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl font-bold sm:text-4xl">Ward {ward.number}</h1>
          <p className="text-sm text-ink-2">
            {council.name} ({council.code}) · IEC ward {ward.id}
          </p>
        </div>
        <ShareButton title={`Ward ${ward.number}, ${council.name}: 2026 results`} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi
          label={ward.declared ? "Won by" : "Leading"}
          value={ward.parties[0] ? <PartyLabel id={ward.parties[0].id} short={ward.parties[0].short} /> : "–"}
          sub={ward.parties[0]?.candidate ? titleCase(ward.parties[0].candidate) : undefined}
        />
        <Kpi label="Margin" value={vn ? fmtPct(vn.marginPct) : "–"} sub={vn ? `${fmtInt(vn.margin)} votes` : undefined} />
        <Kpi label="Voting districts in" value={<span className="tally">{ward.vdsReported}/{ward.vdsTotal}</span>} />
        <Kpi label="Valid ward votes" value={<span className="tally">{fmtInt(ward.valid)}</span>} />
      </div>
      <p className="mt-2">
        <AsOf iso={ward.reportDate || council.reportDate} label="IEC report" />
      </p>

      <Section id="candidates" title="Ward ballot" intro="Votes for each ward candidate. The winner takes the ward seat.">
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">Ward ballot results</caption>
            <thead className="text-left text-xs text-ink-2">
              <tr className="border-b border-line">
                <th scope="col" className="px-3 py-2 font-medium">Party · candidate</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Votes</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ward.parties.map((x) => (
                <tr key={x.id}>
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <PartyLabel id={x.id} short={x.short} title={nameOf.get(x.id)} />
                    {x.candidate ? <span className="block pl-4 text-xs text-ink-3">{titleCase(x.candidate)}</span> : null}
                  </th>
                  <td className="tally px-3 py-2 text-right">{fmtInt(x.votes)}</td>
                  <td className="tally px-3 py-2 text-right">{fmtPct(pctOf(x.votes, ward.valid))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {vn ? (
          <p className="mt-3 rounded-lg border border-line bg-surface p-3 text-sm">
            <strong>Votes needed.</strong> {shortOf.get(vn.runnerUpId) ?? "The runner-up"} would have needed{" "}
            <span className="tally font-semibold">{fmtInt(vn.additional)}</span> more votes to {ward.declared ? "win" : "take the lead"}, or{" "}
            <span className="tally font-semibold">{fmtInt(vn.switchers)}</span> voters switching from {shortOf.get(vn.leaderId) ?? "the leader"}.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-ink-3">Turnout is not published per ward in the IEC results files, so it is not shown here.</p>
      </Section>

      <Section
        id="change"
        title="Change since 2021"
        intro={
          cmp && cmp.matchedVds > 0
            ? `Ward boundaries were redrawn for 2026, so this compares the same voting districts in both years: ${cmp.matchedVds} of the ${cmp.reportedVds} districts counted so far existed in 2021, holding ${Math.round(cmp.coverage * 100)}% of the votes counted. Shares are of all valid votes (ward and PR ballots).`
            : undefined
        }
      >
        {!previous ? (
          <p className="text-sm text-ink-2">2021 results for this council are not available just now.</p>
        ) : !cmp || cmp.matchedVds === 0 ? (
          <p className="text-sm text-ink-2">None of this ward&rsquo;s counted voting districts can be matched to 2021 yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-sm">
              <caption className="sr-only">Party shares in 2021 and 2026 on matched voting districts</caption>
              <thead className="text-left text-xs text-ink-2">
                <tr className="border-b border-line">
                  <th scope="col" className="px-3 py-2 font-medium">Party</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">2021</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">2026</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {swingRows.map((x) => (
                  <tr key={x.id}>
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <PartyLabel id={x.id} short={shortOf.get(x.id) ?? prevShort.get(x.id) ?? String(x.id)} />
                    </th>
                    <td className="tally px-3 py-2 text-right text-ink-2">{x.then > 0 ? fmtPct(x.then) : "–"}</td>
                    <td className="tally px-3 py-2 text-right">{fmtPct(x.now)}</td>
                    <td className="tally px-3 py-2 text-right font-semibold">{x.then > 0 ? fmtShift(x.swing) : "new"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="vds" title={`Voting districts (${ward.vds.length})`}>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">Results by voting district</caption>
            <thead className="text-left text-xs text-ink-2">
              <tr className="border-b border-line">
                <th scope="col" className="px-3 py-2 font-medium">District</th>
                <th scope="col" className="px-3 py-2 font-medium">Leading</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Valid votes</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">In 2021</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ward.vds.map((v) => {
                const lead = v.votes[0];
                return (
                  <tr key={v.id}>
                    <th scope="row" className="tally px-3 py-2 text-left font-normal">{v.id}</th>
                    <td className="px-3 py-2">
                      {lead ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Swatch id={lead[0]} />
                          {shortOf.get(lead[0]) ?? lead[0]} <span className="tally text-ink-2">{fmtPct(pctOf(lead[1], v.valid))}</span>
                        </span>
                      ) : (
                        <span className="text-ink-3">Not counted yet</span>
                      )}
                    </td>
                    <td className="tally px-3 py-2 text-right">{v.valid > 0 ? fmtInt(v.valid) : "–"}</td>
                    <td className="px-3 py-2 text-right text-xs text-ink-2">{previous ? (previous.vds[v.id] ? "yes" : "new") : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
