import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CITIES, citiesFor } from "./cities";
import { projectPoint, type MapGeometry } from "./geo";
import { normaliseNational } from "./iec/normalise";
import assets from "./geo-data/map-assets.json";

const geo = JSON.parse(readFileSync(join(process.cwd(), "public", assets.councils), "utf8")) as MapGeometry;
const nat = normaliseNational(JSON.parse(readFileSync(join(process.cwd(), "fixtures", "2026", "national.json"), "utf8")));
const provinceOf = new Map(nat.councils.map((c) => [c.id, c.provinceId]));

/** Rings from an "M x,y L x,y ... Z" path. */
function rings(d: string): [number, number][][] {
  return d
    .split("M")
    .filter(Boolean)
    .map((r) => r.replace("Z", "").split("L").map((p) => p.split(",").map(Number) as [number, number]));
}

function inside([x, y]: [number, number], ring: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

describe("city labels", () => {
  it("has a projection on the map asset", () => {
    expect(geo.projection).toBeDefined();
  });

  it.each(CITIES.map((c) => [c.name, c] as const))("%s falls inside a council in its province", (_n, c) => {
    const pt = projectPoint(c.lon, c.lat, geo.projection!);
    const hits = geo.shapes.filter((s) => {
      // even-odd across all rings of the shape
      return rings(s.d).reduce((acc, r) => (inside(pt, r) ? !acc : acc), false);
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((s) => provinceOf.get(s.id))).toContain(c.provinceId);
  });

  it("shows only tier-1 cities nationally and every city when zoomed", () => {
    expect(citiesFor().every((c) => c.tier === 1)).toBe(true);
    expect(citiesFor(3).map((c) => c.name)).toEqual(expect.arrayContaining(["Johannesburg", "Pretoria", "Ekurhuleni", "Vereeniging"]));
  });
});
