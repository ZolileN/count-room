"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { layoutLabels } from "@/lib/labels";
import { PlaceLabels, WardNumbers } from "./PlaceLabels";
import { useUnitsPerPixel } from "./useUnitsPerPixel";
import { partyColour } from "@/lib/parties";
import { MapSvg, partyFill, swingFill, type ShapeStyle } from "./MapSvg";
import { useGeometry } from "./useGeometry";

export interface WardMapWard {
  id: number;
  number: number;
  declared: boolean;
  leader: { id: number; short: string; candidate?: string } | null;
  marginPct: number | null;
  /** Swing by party ID (pp), matched voting districts only; null if no 2021 match. */
  swing: Record<number, number> | null;
  coverage: number;
}

type Mode = "winner" | "swing";

function fmtPP(v: number): string {
  const r = Number(v.toFixed(1));
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}`;
}

export function WardMap({
  wards,
  parties,
  councilId,
  councilName,
  hasSwing,
}: {
  wards: WardMapWard[];
  parties: { id: number; short: string }[];
  councilId: number;
  councilName: string;
  hasSwing: boolean;
}) {
  const { geometry, failed } = useGeometry(`/api/map/wards/${councilId}`);
  const [mode, setMode] = useState<Mode>("winner");
  const [party, setParty] = useState<number>(parties[0]?.id ?? 0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showTowns, setShowTowns] = useState(true);
  const [showNumbers, setShowNumbers] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const upp = useUnitsPerPixel(wrap, [geometry]);
  const byId = useMemo(() => new Map(wards.map((w) => [w.id, w])), [wards]);
  const partyShort = parties.find((p) => p.id === party)?.short ?? "";

  const styles = useMemo(() => {
    const m = new Map<number, ShapeStyle>();
    for (const w of wards) {
      let fill = "var(--map-neutral)";
      let label = `Ward ${w.number}: no votes yet`;
      if (mode === "winner" && w.leader) {
        fill = partyFill(partyColour(w.leader.id), w.declared);
        label = `Ward ${w.number}: ${w.leader.short} ${w.declared ? "won" : "leads"}${w.marginPct !== null ? ` by ${w.marginPct.toFixed(1)} points` : ""}`;
      } else if (mode === "swing") {
        const s = w.swing && w.coverage >= 0.5 ? w.swing[party] : undefined;
        fill = swingFill(s);
        label = s === undefined ? `Ward ${w.number}: no like-for-like comparison` : `Ward ${w.number}: ${partyShort} ${fmtPP(s)} points since 2021`;
      }
      m.set(w.id, { fill, label, highlight: selected === w.id });
    }
    return m;
  }, [wards, mode, party, partyShort, selected]);

  const sel = selected !== null ? byId.get(selected) : undefined;

  const numberItems = useMemo(
    () => (geometry && showNumbers ? geometry.shapes.map((s) => ({ id: s.id, label: String(byId.get(s.id)?.number ?? s.id % 1000), x: s.cx, y: s.cy })) : []),
    [geometry, showNumbers, byId],
  );
  const placed = useMemo(() => {
    if (!geometry?.labels || !upp || !showTowns) return [];
    const [vx, vy, vw, vh] = geometry.viewBox.split(" ").map(Number) as [number, number, number, number];
    // Keep town names clear of ward numbers when both are shown.
    const avoid = numberItems.map((n) => ({ x0: n.x - 8 * upp, y0: n.y - 6 * upp, x1: n.x + 8 * upp, y1: n.y + 6 * upp }));
    return layoutLabels(geometry.labels, { upp, view: [vx, vy, vw, vh], max: 18, avoid });
  }, [geometry, upp, showTowns, numberItems]);
  const btn = (active: boolean) =>
    `min-h-9 rounded-md border px-3 text-sm ${active ? "border-ink bg-surface-2 font-semibold" : "border-line bg-surface text-ink-2"}`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Map view">
        <button type="button" className={btn(mode === "winner")} aria-pressed={mode === "winner"} onClick={() => setMode("winner")}>
          Ward winners
        </button>
        {hasSwing ? (
          <button type="button" className={btn(mode === "swing")} aria-pressed={mode === "swing"} onClick={() => setMode("swing")}>
            Change since 2021
          </button>
        ) : null}
        {mode === "swing" ? (
          <label className="text-sm">
            <span className="sr-only">Party</span>
            <select value={party} onChange={(e) => setParty(Number(e.target.value))} className="min-h-9 rounded-md border border-line bg-surface px-2">
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.short}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div ref={wrap} className="rounded-lg border border-line bg-surface p-2">
        {geometry ? (
          <MapSvg geometry={geometry} styles={styles} label={`${councilName} ward map`} onSelect={(id) => setSelected((s) => (s === id ? null : id))}>
            {upp && numberItems.length ? <WardNumbers items={numberItems} upp={upp} /> : null}
            {upp && placed.length ? <PlaceLabels placed={placed} upp={upp} /> : null}
          </MapSvg>
        ) : (
          <div className="grid aspect-[10/9] place-items-center text-sm text-ink-3">{failed ? "The ward map could not load." : "Loading ward map…"}</div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-3">{geometry?.labels?.length ? "Place names: GeoNames (CC BY 4.0)" : ""}</span>
        <span className="flex gap-2">
          {geometry?.labels?.length ? (
            <button type="button" aria-pressed={showTowns} onClick={() => setShowTowns((v) => !v)} className="rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:border-line-strong">
              {showTowns ? "Hide towns" : "Show towns"}
            </button>
          ) : null}
          <button type="button" aria-pressed={showNumbers} onClick={() => setShowNumbers((v) => !v)} className="rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:border-line-strong">
            {showNumbers ? "Hide ward numbers" : "Show ward numbers"}
          </button>
        </span>
      </div>

      {mode === "winner" ? (
        <p className="mt-2 text-xs text-ink-3">
          Solid: ward declared. Pale: leading while counting. Grey: no votes yet. Tap a ward for details.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
          <span>{partyShort} share change, points:</span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="inline-block h-2.5 w-10 rounded-sm" style={{ background: "linear-gradient(90deg, var(--loss), var(--map-neutral), var(--gain))" }} />
            −15 · 0 · +15
          </span>
          <span className="text-ink-3">Compared on voting districts counted in both years.</span>
        </div>
      )}

      <div aria-live="polite" className="mt-2 min-h-12">
        {sel ? (
          <div className="rounded-lg border border-line bg-surface p-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <strong>Ward {sel.number}</strong>
              <Link href={`/councils/${councilId}/wards/${sel.number}`} className="underline">Ward details</Link>
            </div>
            {sel.leader ? (
              <p className="mt-1">
                <span aria-hidden className="mr-1 inline-block size-2.5 rounded-[3px]" style={{ background: partyColour(sel.leader.id) }} />
                {sel.leader.short} {sel.declared ? "won" : "leads"}
                {sel.marginPct !== null ? ` by ${sel.marginPct.toFixed(1)} points` : ""}
                {sel.leader.candidate ? ` (${sel.leader.candidate})` : ""}
              </p>
            ) : (
              <p className="mt-1 text-ink-2">No votes counted yet.</p>
            )}
            {mode === "swing" && sel.swing && sel.swing[party] !== undefined ? (
              <p className="mt-1 text-ink-2">
                {partyShort}: {fmtPP(sel.swing[party]!)} points since 2021 ({Math.round(sel.coverage * 100)}% of counted votes comparable)
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
