/**
 * Greedy, collision-free label placement for map place names. Pure.
 *
 * Labels are taken best-score first; each tries right, left, above, then below its dot, and is
 * kept only if its box stays on the visible map and clear of every label already placed. Sizes
 * are in screen pixels, converted with `upp` (viewBox units per pixel), so the result adapts to
 * zoom and screen width.
 */
import type { MapLabel } from "./geo";

export type Side = "right" | "left" | "above" | "below";

export interface PlacedLabel {
  name: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  anchor: "start" | "end" | "middle";
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export interface LayoutOptions {
  upp: number;
  /** Visible area in viewBox units [x, y, width, height]. */
  view: [number, number, number, number];
  fontPx?: number;
  max?: number;
  /** Extra boxes to keep clear of (viewBox units). */
  avoid?: Box[];
}

/** Rough text width: average glyph is ~0.56 em in the UI sans at this size. */
export function textWidthPx(name: string, fontPx: number): number {
  return name.length * fontPx * 0.56;
}

export function layoutLabels(labels: MapLabel[], opts: LayoutOptions): PlacedLabel[] {
  const { upp, view } = opts;
  const font = (opts.fontPx ?? 12) * upp;
  const gap = 5 * upp;
  const pad = 2 * upp;
  const [vx, vy, vw, vh] = view;
  const inView = (b: Box) => b.x0 >= vx && b.y0 >= vy && b.x1 <= vx + vw && b.y1 <= vy + vh;
  const taken: Box[] = [...(opts.avoid ?? [])];
  const out: PlacedLabel[] = [];
  const sorted = [...labels].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  for (const l of sorted) {
    if (out.length >= (opts.max ?? 24)) break;
    if (l.x < vx || l.x > vx + vw || l.y < vy || l.y > vy + vh) continue;
    const w = textWidthPx(l.name, opts.fontPx ?? 12) * upp;
    const h = font * 1.15;
    const dot: Box = { x0: l.x - 3 * upp, y0: l.y - 3 * upp, x1: l.x + 3 * upp, y1: l.y + 3 * upp };
    if (taken.some((t) => overlaps(t, dot))) continue;
    const options: [Side, Box, number, number, PlacedLabel["anchor"]][] = [
      ["right", { x0: l.x + gap - pad, y0: l.y - h / 2 - pad, x1: l.x + gap + w + pad, y1: l.y + h / 2 + pad }, l.x + gap, l.y + font * 0.35, "start"],
      ["left", { x0: l.x - gap - w - pad, y0: l.y - h / 2 - pad, x1: l.x - gap + pad, y1: l.y + h / 2 + pad }, l.x - gap, l.y + font * 0.35, "end"],
      ["above", { x0: l.x - w / 2 - pad, y0: l.y - gap - h - pad, x1: l.x + w / 2 + pad, y1: l.y - gap + pad }, l.x, l.y - gap - font * 0.25, "middle"],
      ["below", { x0: l.x - w / 2 - pad, y0: l.y + gap - pad, x1: l.x + w / 2 + pad, y1: l.y + gap + h + pad }, l.x, l.y + gap + font * 0.85, "middle"],
    ];
    const fit = options.find(([, box]) => inView(box) && !taken.some((t) => overlaps(t, box)));
    if (!fit) continue;
    taken.push(fit[1], dot);
    out.push({ name: l.name, x: l.x, y: l.y, tx: fit[2], ty: fit[3], anchor: fit[4] });
  }
  return out;
}
