import type { MapGeometry } from "@/lib/geo";

export interface ShapeStyle {
  fill: string;
  /** Tooltip / accessible name. */
  label: string;
  href?: string;
  /** Draw the amber hatch on top (hung councils). */
  hatch?: boolean;
  /** Outline this shape (selected). */
  highlight?: boolean;
}

/**
 * Plain SVG choropleth. Every shape has a text label (tooltip and accessible name); shapes with an
 * `href` are links, so the map works with keyboard and screen readers. No hooks: usable from
 * server and client components.
 */
export function MapSvg({
  geometry,
  styles,
  label,
  viewBox,
  onSelect,
  children,
  zoom = 1,
  touchAction,
}: {
  geometry: MapGeometry;
  styles: Map<number, ShapeStyle>;
  label: string;
  viewBox?: string;
  onSelect?: (id: number) => void;
  /** Drawn on top of the shapes and ignored by taps (labels). */
  children?: React.ReactNode;
  /** Current zoom factor, so the hatch keeps the same on-screen density. */
  zoom?: number;
  touchAction?: string;
}) {
  // Borders are drawn in screen pixels (non-scaling), so they stay hairline at any zoom.
  const hatch = 10 / zoom;
  return (
    <svg
      viewBox={viewBox ?? geometry.viewBox}
      width="100%"
      role="group"
      aria-label={label}
      className="block h-auto max-h-[70vh] select-none"
      style={{ touchAction: touchAction ?? "manipulation" }}
    >
      <defs>
        <pattern id="hatch" width={hatch} height={hatch} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={hatch} stroke="var(--hung)" strokeWidth={hatch * 0.4} />
        </pattern>
      </defs>
      {geometry.shapes.map((s) => {
        const st = styles.get(s.id);
        const body = (
          <>
            <path d={s.d} fill={st?.fill ?? "var(--map-neutral)"} stroke="var(--map-stroke)" strokeWidth={0.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" fillRule="evenodd" />
            {st?.hatch ? <path d={s.d} fill="url(#hatch)" fillOpacity="0.85" stroke="none" fillRule="evenodd" pointerEvents="none" /> : null}
            {st?.highlight ? <path d={s.d} fill="none" stroke="var(--ink)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" /> : null}
            <title>{st?.label ?? ""}</title>
          </>
        );
        if (st?.href) {
          return (
            <a key={s.id} href={st.href} aria-label={st.label} className="focus:outline-none [&:focus-visible>path:first-child]:stroke-[var(--focus)]">
              {body}
            </a>
          );
        }
        if (onSelect) {
          return (
            <g
              key={s.id}
              role="button"
              tabIndex={0}
              aria-label={st?.label}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(s.id);
                }
              }}
              className="cursor-pointer focus:outline-none [&:focus-visible>path:first-child]:stroke-[var(--focus)]"
            >
              {body}
            </g>
          );
        }
        return <g key={s.id}>{body}</g>;
      })}
      {children ? <g pointerEvents="none">{children}</g> : null}
    </svg>
  );
}

/** Diverging fill for a swing in percentage points, saturating at ±limit. */
export function swingFill(pp: number | undefined, limit = 15): string {
  if (pp === undefined || !Number.isFinite(pp)) return "var(--map-neutral)";
  const t = Math.min(1, Math.abs(pp) / limit);
  const pct = Math.round(15 + t * 85);
  return `color-mix(in oklab, var(${pp >= 0 ? "--gain" : "--loss"}) ${pct}%, var(--map-neutral))`;
}

/** A party colour, washed out when the result is not final. */
export function partyFill(colour: string, final: boolean): string {
  return final ? colour : `color-mix(in oklab, ${colour} 45%, var(--map-neutral))`;
}
