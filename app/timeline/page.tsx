import type { Metadata } from "next";
import Link from "next/link";
import { AsOf } from "@/components/AsOf";
import { Unavailable } from "@/components/DataNotice";
import { LineChart, type LineSeries } from "@/components/LineChart";
import { Section } from "@/components/Section";
import { loadNational, loadTimeline } from "@/lib/data";
import { fmtPct, pctOf } from "@/lib/format";
import { OTHER_ID } from "@/lib/iec/types";
import type { TimelinePoint } from "@/lib/snapshot";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Timeline",
  description: "How the count, the projection and the number of hung councils moved through election night.",
};

const TOP = 6;

function topParties(last: TimelinePoint): number[] {
  const src = last.projected ? Object.entries(last.projected).map(([id, v]) => [Number(id), v.p] as const) : Object.entries(last.raw).map(([id, v]) => [Number(id), v] as const);
  return src.filter(([id]) => id !== OTHER_ID).sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([id]) => id);
}

export default async function TimelinePage() {
  const [tl, nat] = await Promise.all([loadTimeline(), loadNational()]);
  if (!tl.ok) return <Unavailable what="The timeline" />;
  const { points, source } = tl.value;
  const names = new Map(nat.ok ? nat.value.data.parties.map((p) => [p.id, p.short]) : []);
  const short = (id: number) => names.get(id) ?? String(id);

  if (points.length < 2) {
    return (
      <>
        <h1 className="display text-3xl font-bold sm:text-4xl">Timeline</h1>
        <div className="mt-4 rounded-lg border border-line bg-surface p-4 text-sm text-ink-2">
          {source === "none"
            ? "Snapshots are not being stored on this deployment (no database configured), so there is no count history to show yet."
            : "Not enough snapshots yet. A new point is stored about every five minutes while results come in."}{" "}
          <Link href="/" className="underline">See the current count</Link>.
        </div>
      </>
    );
  }

  const last = points[points.length - 1]!;
  const ids = topParties(last);
  const t = (p: TimelinePoint) => Date.parse(p.reportDate);
  const projected: LineSeries[] = ids.map((id) => ({
    id,
    label: short(id),
    points: points.filter((p) => p.projected?.[id]).map((p) => ({ t: t(p), v: p.projected![id]!.p, lo: p.projected![id]!.lo, hi: p.projected![id]!.hi })),
  }));
  const raw: LineSeries[] = ids.map((id) => ({
    id,
    label: short(id),
    points: points.filter((p) => p.raw[id] !== undefined).map((p) => ({ t: t(p), v: p.raw[id]! })),
  }));
  const progress: LineSeries[] = [
    { id: 1, label: "VDs in", points: points.map((p) => ({ t: t(p), v: pctOf(p.vdsComplete, p.vdsExpected) })) },
  ];
  const councils: LineSeries[] = [
    { id: 1, label: "Hung", points: points.map((p) => ({ t: t(p), v: p.hung })) },
    { id: 2, label: "Majority", points: points.map((p) => ({ t: t(p), v: p.majority })) },
  ];
  const statusColour = (id: number) => (id === 1 ? "var(--hung)" : "var(--ink-2)");

  return (
    <>
      <div className="mb-5">
        <h1 className="display text-3xl font-bold sm:text-4xl">Timeline</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-2">
          How the count moved through the night: {points.length} snapshots of the IEC national report
          {source === "fixtures" ? " (local fixture history)" : ""}. Times are the IEC&rsquo;s report times.
        </p>
        <p className="mt-1">
          <AsOf iso={last.reportDate} label="Latest snapshot" />
        </p>
      </div>

      <Section id="projected" title="Projected national share" intro="The projection at each snapshot, with its 90% range shaded. The range narrows as more voting districts report.">
        <div className="rounded-lg border border-line bg-surface p-3">
          <LineChart series={projected} label="Projected national share over time" />
        </div>
      </Section>

      <Section id="raw" title="Raw count" intro="The IEC's national share of votes counted so far at each snapshot, before any adjustment.">
        <div className="rounded-lg border border-line bg-surface p-3">
          <LineChart series={raw} label="Raw national share over time" />
        </div>
      </Section>

      <Section id="progress" title="Voting districts reported">
        <div className="rounded-lg border border-line bg-surface p-3">
          <LineChart series={progress} label="Share of voting districts reported" height={180} colourOf={() => "var(--ink-2)"} />
        </div>
        <p className="mt-2 text-xs text-ink-3">Now {fmtPct(pctOf(last.vdsComplete, last.vdsExpected))} of voting districts.</p>
      </Section>

      <Section id="councils" title="Declared councils">
        <div className="rounded-lg border border-line bg-surface p-3">
          <LineChart series={councils} label="Hung and majority councils declared" unit="" height={200} colourOf={statusColour} />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Now {last.hung} hung and {last.majority} with a majority, of {last.declared} declared.
        </p>
      </Section>
    </>
  );
}
