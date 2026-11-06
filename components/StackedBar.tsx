import { partyColour } from "@/lib/parties";
import { fmtPct } from "@/lib/format";

export interface Segment {
  id: number;
  short: string;
  value: number;
}

/**
 * 100% stacked bar. Segments are separated by 2px surface-coloured gaps; each carries a native
 * tooltip; the whole bar has a text description for screen readers.
 */
export function StackedBar({ segments, total, label, height = 14 }: { segments: Segment[]; total: number; label: string; height?: number }) {
  const t = total > 0 ? total : segments.reduce((a, s) => a + s.value, 0);
  let x = 0;
  const parts = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const w = t > 0 ? (s.value / t) * 100 : 0;
      const seg = { ...s, x, w };
      x += w;
      return seg;
    });
  const desc = `${label}: ${parts.map((p) => `${p.short} ${fmtPct(p.w)}`).join(", ")}`;
  return (
    <svg width="100%" height={height} role="img" aria-label={desc} className="block overflow-visible">
      <rect x="0" y="0" width="100%" height={height} rx="4" fill="var(--track)" />
      {parts.map((p) => (
        <rect
          key={p.id}
          x={`${p.x}%`}
          y="0"
          width={`${p.w}%`}
          height={height}
          rx="3"
          fill={partyColour(p.id)}
          stroke="var(--surface)"
          strokeWidth="2"
        >
          <title>{`${p.short}: ${fmtPct(p.w)}`}</title>
        </rect>
      ))}
    </svg>
  );
}

/** Thin progress line with its value in text beside it. */
export function ProgressLine({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <svg width="100%" height="4" role="img" aria-label={`${label}: ${fmtPct(pct, 0)}`} className="block">
        <rect x="0" y="0" width="100%" height="4" rx="2" fill="var(--track)" />
        <rect x="0" y="0" width={`${pct}%`} height="4" rx="2" fill="var(--ink-2)" />
      </svg>
      <span className="tally w-10 shrink-0 text-right text-xs text-ink-2">{fmtPct(pct, 0)}</span>
    </div>
  );
}
