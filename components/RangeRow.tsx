import { partyColour } from "@/lib/parties";

/** Ticks for a 0..max percentage axis. */
export function ticksFor(max: number): number[] {
  const step = max > 40 ? 10 : max > 16 ? 5 : max > 6 ? 2 : 1;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

export function AxisRow({ max, unit = "%" }: { max: number; unit?: string }) {
  const ticks = ticksFor(max);
  return (
    <svg width="100%" height="16" aria-hidden className="block overflow-visible">
      {ticks.map((t) => (
        <text key={t} x={`${(t / max) * 100}%`} y="11" textAnchor={t === 0 ? "start" : "middle"} fontSize="10" fill="var(--ink-3)" className="tally">
          {t}
          {t === ticks[ticks.length - 1] ? unit : ""}
        </text>
      ))}
    </svg>
  );
}

/**
 * One party on a shared 0..max axis: the 90% range as a band, the raw count as a hollow ring and
 * the projection as a solid dot.
 */
export function RangeRow({
  id,
  max,
  raw,
  point,
  low,
  high,
  label,
}: {
  id: number;
  max: number;
  raw: number;
  point: number;
  low?: number;
  high?: number;
  label: string;
}) {
  const x = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const ticks = ticksFor(max);
  const H = 22;
  const c = partyColour(id);
  return (
    <svg width="100%" height={H} role="img" aria-label={label} className="block overflow-visible">
      {ticks.map((t) => (
        <line key={t} x1={x(t)} x2={x(t)} y1="2" y2={H - 2} stroke="var(--line)" strokeWidth="1" />
      ))}
      {low !== undefined && high !== undefined ? (
        <>
          <line x1={x(low)} x2={x(high)} y1={H / 2} y2={H / 2} stroke={c} strokeOpacity="0.35" strokeWidth="8" strokeLinecap="round" />
          <line x1={x(low)} x2={x(low)} y1={H / 2 - 5} y2={H / 2 + 5} stroke={c} strokeWidth="2" strokeLinecap="round" />
          <line x1={x(high)} x2={x(high)} y1={H / 2 - 5} y2={H / 2 + 5} stroke={c} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <line x1={x(Math.min(raw, point))} x2={x(Math.max(raw, point))} y1={H / 2} y2={H / 2} stroke="var(--ink-3)" strokeWidth="2" />
      )}
      <circle cx={x(raw)} cy={H / 2} r="4.5" fill="var(--surface)" stroke="var(--ink-2)" strokeWidth="2" />
      <circle cx={x(point)} cy={H / 2} r="5" fill={c} stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}
