import type { City } from "@/lib/cities";
import { projectPoint, type MapProjection } from "@/lib/geo";

/**
 * City dots and names drawn inside a map SVG. `upp` is viewBox units per screen pixel, so labels
 * keep the same on-screen size at any zoom. Decorative (the map's shapes carry the data), so hidden
 * from screen readers.
 */
export function CityLabels({ cities, projection, upp }: { cities: City[]; projection: MapProjection; upp: number }) {
  const font = 12.5 * upp;
  const gap = 5 * upp;
  return (
    <g aria-hidden className="select-none">
      {cities.map((c) => {
        const [x, y] = projectPoint(c.lon, c.lat, projection);
        const tx = c.side === "right" ? x + gap : c.side === "left" ? x - gap : x;
        const ty = c.side === "above" ? y - gap * 1.3 : c.side === "below" ? y + gap + font * 0.75 : y + font * 0.35;
        const anchor = c.side === "right" ? "start" : c.side === "left" ? "end" : "middle";
        return (
          <g key={c.name}>
            <circle cx={x} cy={y} r={2.6 * upp} fill="var(--ink)" stroke="var(--surface)" strokeWidth={1.4 * upp} />
            <text
              x={tx}
              y={ty}
              textAnchor={anchor}
              fontSize={font}
              fontWeight={c.tier === 1 ? 650 : 500}
              fill="var(--ink)"
              stroke="var(--surface)"
              strokeWidth={3.2 * upp}
              strokeLinejoin="round"
              paintOrder="stroke"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {c.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
