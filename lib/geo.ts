/**
 * Boundary geometry: simplify IEC GeoJSON and turn it into SVG paths. Pure functions.
 *
 * Maps are drawn as plain SVG, not a tile map: a results choropleth needs no basemap, SVG paths are
 * small once simplified, and nothing is fetched from a third-party tile server.
 */

export type Position = [number, number];
export type Ring = Position[];

export interface GeoFeature {
  properties: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] } | null;
}

export interface MapShape {
  id: number;
  /** SVG path in the map's viewBox units. */
  d: string;
  /** Label anchor (centroid of the largest ring). */
  cx: number;
  cy: number;
}

/** How lon/lat were turned into viewBox units, so points (e.g. cities) can be placed on the map. */
export interface MapProjection {
  minX: number;
  maxY: number;
  /** cos(mid-latitude): horizontal scale correction. */
  k: number;
  /** viewBox units per degree of latitude. */
  scale: number;
}

export interface MapGeometry {
  viewBox: string;
  width: number;
  height: number;
  shapes: MapShape[];
  projection?: MapProjection;
}

/** Project a lon/lat point into a map's viewBox units. */
export function projectPoint(lon: number, lat: number, p: MapProjection): Position {
  return [(lon - p.minX) * p.k * p.scale, (p.maxY - lat) * p.scale];
}

function sqSegDist(p: Position, a: Position, b: Position): number {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas–Peucker simplification of an open polyline (iterative, no recursion limit). */
export function simplifyLine(points: Position[], tolerance: number): Position[] {
  if (points.length <= 2) return points.slice();
  const sq = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(points[i]!, points[first]!, points[last]!);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > sq) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplify a closed ring; returns null if it collapses below a triangle. */
export function simplifyRing(ring: Ring, tolerance: number): Ring | null {
  if (ring.length < 4) return null;
  const s = simplifyLine(ring, tolerance);
  if (s.length < 4) {
    // Keep tiny islands visible as a triangle from their extreme points rather than dropping them.
    return ring.length >= 4 ? [ring[0]!, ring[Math.floor(ring.length / 3)]!, ring[Math.floor((2 * ring.length) / 3)]!, ring[0]!] : null;
  }
  return s;
}

export function polygonsOf(f: GeoFeature): Ring[][] {
  if (!f.geometry) return [];
  return f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
}

function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j]![0] + r[i]![0]) * (r[j]![1] - r[i]![1]);
  return Math.abs(a / 2);
}

function ringCentroid(r: Ring): Position {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j]![0] * r[i]![1] - r[i]![0] * r[j]![1];
    x += (r[j]![0] + r[i]![0]) * f;
    y += (r[j]![1] + r[i]![1]) * f;
    a += f;
  }
  if (a === 0) return r[0]!;
  return [x / (3 * a), y / (3 * a)];
}

/**
 * Project lon/lat features into an SVG viewBox `width` wide (equirectangular, x scaled by the
 * cosine of the mid-latitude: accurate enough at South Africa's scale), simplify, and emit paths.
 * `tolerance` is in output pixels.
 */
export function toSvgPaths(
  features: GeoFeature[],
  idOf: (f: GeoFeature) => number | null,
  opts: { width?: number; tolerance?: number; precision?: number } = {},
): MapGeometry {
  const width = opts.width ?? 1000;
  const tol = opts.tolerance ?? 0.6;
  const prec = opts.precision ?? 1;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of features)
    for (const poly of polygonsOf(f))
      for (const [x, y] of poly[0] ?? []) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (!Number.isFinite(minX)) return { viewBox: "0 0 1 1", width: 1, height: 1, shapes: [] };

  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const spanX = (maxX - minX) * k || 1e-9;
  const scale = width / spanX;
  const height = Math.max(1, Math.round((maxY - minY) * scale));
  const project = (p: Position): Position => [(p[0] - minX) * k * scale, (maxY - p[1]) * scale];
  const r = (v: number) => Number(v.toFixed(prec));

  const shapes: MapShape[] = [];
  for (const f of features) {
    const id = idOf(f);
    if (id === null) continue;
    let d = "";
    let best: { area: number; c: Position } | null = null;
    for (const poly of polygonsOf(f)) {
      poly.forEach((ring, ri) => {
        const s = simplifyRing(ring.map(project), tol);
        if (!s) return;
        d += "M" + s.slice(0, -1).map((p) => `${r(p[0])},${r(p[1])}`).join("L") + "Z";
        if (ri === 0) {
          const area = ringArea(s);
          if (!best || area > best.area) best = { area, c: ringCentroid(s) };
        }
      });
    }
    if (!d) continue;
    const c = (best as { c: Position } | null)?.c ?? [0, 0];
    shapes.push({ id, d, cx: r(c[0]), cy: r(c[1]) });
  }
  return { viewBox: `0 0 ${width} ${height}`, width, height, shapes, projection: { minX, maxY, k, scale } };
}

/** Pick a numeric property, tolerating string IDs. */
export function numProp(f: GeoFeature, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = f.properties[k];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}
