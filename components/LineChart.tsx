import { partyColour } from "@/lib/parties";
import { fmtTime } from "@/lib/format";

export interface LinePoint {
  t: number; // epoch ms
  v: number;
  lo?: number;
  hi?: number;
}

export interface LineSeries {
  id: number;
  label: string;
  points: LinePoint[];
}

/**
 * Time-series chart: one line per series, optional shaded range, direct labels at the right end,
 * native tooltips on each point. One y-axis only.
 */
export function LineChart({
  series,
  label,
  unit = "%",
  height = 260,
  colourOf = partyColour,
}: {
  series: LineSeries[];
  label: string;
  unit?: string;
  height?: number;
  colourOf?: (id: number) => string;
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  const W = 420; // close to phone width, so 10–11px text stays readable
  const H = height;
  const pad = { l: 30, r: 84, t: 10, b: 22 };
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const vMax = Math.max(...all.map((p) => p.hi ?? p.v));
  const vMin = Math.min(...all.map((p) => p.lo ?? p.v));
  const span = vMax - vMin || 1;
  const step = span > 30 ? 10 : span > 12 ? 5 : span > 5 ? 2 : span > 2 ? 1 : 0.5;
  const y0 = Math.max(0, Math.floor((vMin - span * 0.05) / step) * step);
  const y1 = Math.ceil((vMax + span * 0.05) / step) * step;
  const x = (t: number) => pad.l + (t1 === t0 ? (W - pad.l - pad.r) / 2 : ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - pad.t - pad.b);
  const ticks: number[] = [];
  for (let v = y0; v <= y1 + 1e-9; v += step) ticks.push(Number(v.toFixed(2)));
  const timeTicks = t1 === t0 ? [t0] : [0, 0.25, 0.5, 0.75, 1].map((f) => t0 + f * (t1 - t0));

  // Direct labels: last value of each series, nudged apart so they don't collide.
  const ends = series
    .map((s) => ({ s, last: s.points[s.points.length - 1]! }))
    .filter((e) => e.last)
    .sort((a, b) => y(a.last.v) - y(b.last.v));
  const labelY: number[] = [];
  for (const e of ends) {
    let ly = y(e.last.v);
    const prev = labelY[labelY.length - 1];
    if (prev !== undefined && ly - prev < 12) ly = prev + 12;
    labelY.push(ly);
  }

  const desc = `${label}. ${series.map((s) => `${s.label} ${s.points[s.points.length - 1]?.v.toFixed(1)}${unit}`).join(", ")}.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={desc} className="block h-auto overflow-visible">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
          <text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-3)" className="tally">
            {v}
          </text>
        </g>
      ))}
      {timeTicks.map((t, i) => (
        <text key={i} x={x(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === timeTicks.length - 1 ? "end" : "middle"} fontSize="10" fill="var(--ink-3)" className="tally">
          {fmtTime(new Date(t).toISOString())}
        </text>
      ))}
      {series.map((s) => {
        const c = colourOf(s.id);
        const band = s.points.every((p) => p.lo !== undefined && p.hi !== undefined) && s.points.length > 1;
        return (
          <g key={s.id}>
            {band ? (
              <path
                d={`M${s.points.map((p) => `${x(p.t)},${y(p.hi!)}`).join("L")}L${[...s.points].reverse().map((p) => `${x(p.t)},${y(p.lo!)}`).join("L")}Z`}
                fill={c}
                fillOpacity="0.14"
              />
            ) : null}
            <path d={`M${s.points.map((p) => `${x(p.t)},${y(p.v)}`).join("L")}`} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {s.points.map((p, i) => (
              <circle key={i} cx={x(p.t)} cy={y(p.v)} r={s.points.length > 40 ? 0 : 2.5} fill={c}>
                <title>{`${s.label} ${p.v.toFixed(2)}${unit} at ${fmtTime(new Date(p.t).toISOString())}${p.lo !== undefined ? ` (90%: ${p.lo.toFixed(1)}–${p.hi!.toFixed(1)})` : ""}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {ends.map((e, i) => (
        <g key={e.s.id}>
          <circle cx={x(e.last.t)} cy={y(e.last.v)} r="3.5" fill={colourOf(e.s.id)} stroke="var(--surface)" strokeWidth="1.5" />
          <text x={W - pad.r + 6} y={labelY[i]! + 3.5} fontSize="11" fill="var(--ink)" className="tally">
            {e.s.label} {e.last.v.toFixed(1)}
          </text>
        </g>
      ))}
    </svg>
  );
}
