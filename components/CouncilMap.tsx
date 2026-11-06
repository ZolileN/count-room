"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { citiesFor } from "@/lib/cities";
import { CityLabels } from "./CityLabels";
import mapAssets from "@/lib/geo-data/map-assets.json";
import type { MapCouncil } from "@/lib/map-councils";
import { partyColour } from "@/lib/parties";
import { MapSvg, partyFill, type ShapeStyle } from "./MapSvg";
import { useGeometry } from "./useGeometry";


/** Bounding box of a path's coordinates, for zooming to a province. */
function bbox(d: string): [number, number, number, number] {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]!, y = nums[i + 1]!;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/**
 * Council choropleth. Boundaries come from a content-hashed static file (fetched once, cached
 * forever); only the colours travel with the page, so the once-a-minute refresh stays small.
 */
export function CouncilMap({ councils, provinces, provinceId }: { councils: MapCouncil[]; provinces: { id: number; name: string }[]; provinceId?: number }) {
  const { geometry, failed } = useGeometry(mapAssets.councils);
  const byId = useMemo(() => new Map(councils.map((c) => [c.id, c])), [councils]);

  const styles = useMemo(() => {
    const m = new Map<number, ShapeStyle>();
    for (const c of councils) {
      const dim = provinceId !== undefined && c.provinceId !== provinceId;
      const status = c.status === "counting" ? `counting, ${Math.round(c.vdsPct)}% in` : c.status;
      m.set(c.id, {
        fill: dim ? "var(--map-neutral)" : c.leader ? partyFill(partyColour(c.leader.id), c.declared) : "var(--map-neutral)",
        label: `${c.name}: ${c.leader ? `${c.leader.short} ${c.declared ? `largest, ${c.leaderSeats} of ${c.totalSeats} seats` : "leads on votes"}` : "no results"}, ${status}`,
        href: `/councils/${c.id}`,
        hatch: !dim && c.status === "hung",
      });
    }
    return m;
  }, [councils, provinceId]);

  const viewBox = useMemo(() => {
    if (!geometry || provinceId === undefined) return undefined;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of geometry.shapes) {
      if (byId.get(s.id)?.provinceId !== provinceId) continue;
      const b = bbox(s.d);
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
    }
    if (!Number.isFinite(x0)) return undefined;
    const pad = Math.max(x1 - x0, y1 - y0) * 0.04;
    return `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`;
  }, [geometry, provinceId, byId]);

  // Screen pixels -> viewBox units, so city labels stay the same size at any zoom.
  const wrap = useRef<HTMLDivElement>(null);
  const [upp, setUpp] = useState<number | null>(null);
  const [showCities, setShowCities] = useState(true);
  useEffect(() => {
    const el = wrap.current;
    if (!el || !geometry) return;
    const measure = () => {
      const svg = el.querySelector("svg");
      if (!svg) return;
      const vb = svg.viewBox.baseVal;
      const r = svg.getBoundingClientRect();
      if (!vb || r.width === 0 || r.height === 0) return;
      setUpp(1 / Math.min(r.width / vb.width, r.height / vb.height));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [geometry, viewBox]);

  const leaders = new Map<number, string>();
  for (const c of councils) if (c.leader && (provinceId === undefined || c.provinceId === provinceId)) leaders.set(c.leader.id, c.leader.short);

  return (
    <div>
      <div ref={wrap} className="rounded-lg border border-line bg-surface p-2">
        {geometry ? (
          <MapSvg geometry={geometry} styles={styles} viewBox={viewBox} label="Map of councils: tap a council to open it">
            {showCities && upp && geometry.projection ? <CityLabels cities={citiesFor(provinceId)} projection={geometry.projection} upp={upp} /> : null}
          </MapSvg>
        ) : (
          <div className="grid place-items-center text-sm text-ink-3" style={{ aspectRatio: "1000 / 877" }}>
            {failed ? (
              <span>
                The map could not load. <Link href="/councils" className="underline">See the list of councils</Link>.
              </span>
            ) : (
              "Loading map…"
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          aria-pressed={showCities}
          onClick={() => setShowCities((v) => !v)}
          className="rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:border-line-strong"
        >
          {showCities ? "Hide city names" : "Show city names"}
        </button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
        {[...leaders].map(([id, short]) => (
          <li key={id} className="inline-flex items-center gap-1">
            <span aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: partyColour(id) }} />
            {short}
          </li>
        ))}
        <li className="inline-flex items-center gap-1">
          <svg aria-hidden width="12" height="12"><rect width="12" height="12" fill="color-mix(in oklab, var(--ink-2) 45%, var(--map-neutral))" /></svg>
          Pale: still counting (leader on votes)
        </li>
        <li className="inline-flex items-center gap-1">
          <svg aria-hidden width="12" height="12"><defs><pattern id="lh" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--hung)" strokeWidth="2" /></pattern></defs><rect width="12" height="12" fill="var(--map-neutral)" /><rect width="12" height="12" fill="url(#lh)" /></svg>
          Hatched: hung
        </li>
      </ul>
      <nav aria-label="Zoom to province" className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link href="/map" className={`rounded-full border px-3 py-1 ${provinceId === undefined ? "border-ink font-semibold" : "border-line"}`}>South Africa</Link>
        {provinces.map((p) => (
          <Link key={p.id} href={`/map/${p.id}`} className={`rounded-full border px-3 py-1 ${provinceId === p.id ? "border-ink font-semibold" : "border-line"}`}>
            {p.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}
