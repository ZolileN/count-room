import type { PlacedLabel } from "@/lib/labels";

/** Town/suburb dots and names inside a map SVG (positions from layoutLabels). Decorative. */
export function PlaceLabels({ placed, upp, fontPx = 12 }: { placed: PlacedLabel[]; upp: number; fontPx?: number }) {
  return (
    <g aria-hidden className="select-none">
      {placed.map((p) => (
        <g key={p.name}>
          <circle cx={p.x} cy={p.y} r={2.4 * upp} fill="var(--ink)" stroke="var(--surface)" strokeWidth={1.3 * upp} />
          <text
            x={p.tx}
            y={p.ty}
            textAnchor={p.anchor}
            fontSize={fontPx * upp}
            fontWeight={600}
            fill="var(--ink)"
            stroke="var(--surface)"
            strokeWidth={3 * upp}
            strokeLinejoin="round"
            paintOrder="stroke"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {p.name}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Ward numbers at each ward's centre. Decorative (wards are also listed in the table). */
export function WardNumbers({ items, upp }: { items: { id: number; label: string; x: number; y: number }[]; upp: number }) {
  return (
    <g aria-hidden className="select-none">
      {items.map((w) => (
        <text
          key={w.id}
          x={w.x}
          y={w.y + 3.5 * upp}
          textAnchor="middle"
          fontSize={10.5 * upp}
          fontWeight={700}
          fill="var(--ink-2)"
          stroke="var(--surface)"
          strokeWidth={2.6 * upp}
          strokeLinejoin="round"
          paintOrder="stroke"
          className="tally"
        >
          {w.label}
        </text>
      ))}
    </g>
  );
}
