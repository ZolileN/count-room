/**
 * Build lib/geo-data/places.json, the town and suburb names used to label ward maps, from the
 * GeoNames South Africa dump (https://download.geonames.org/export/dump/ZA.zip, CC BY 4.0).
 *
 *   npm run build-places -- /path/to/ZA.txt
 *
 * Keeps populated places (feature class P) that are likely to matter on a map: anything with a
 * population, an administrative seat, or at least one alternate name (a decent proxy for
 * notability, since most of the ~10,000 others are farm names). Each gets a score used to decide
 * which labels win when they would overlap.
 *
 * Places within 2.5 km of each other are merged, keeping the better-known name (more alternate
 * names) with the higher score: e.g. Hanover absorbs its township Oakglen, which GeoNames gives a
 * census population while the town itself has none.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MERGE_KM = 2.5;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const k = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const dx = (lon2 - lon1) * 111.32 * k;
  const dy = (lat2 - lat1) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

const CODE_WEIGHT: Record<string, number> = { PPLC: 6, PPLA: 5, PPLA2: 4, PPLA3: 3, PPL: 1 };

async function main() {
  const src = process.argv[2];
  if (!src) throw new Error("usage: npm run build-places -- /path/to/ZA.txt");
  const rows = (await readFile(src, "utf8")).split("\n");
  const candidates: { name: string; lon: number; lat: number; score: number; alt: number }[] = [];
  for (const line of rows) {
    const f = line.split("\t");
    if (f.length < 15 || f[6] !== "P") continue;
    const name = f[1]!.trim();
    const lat = Number(f[4]);
    const lon = Number(f[5]);
    const code = f[7]!;
    const pop = Number(f[14]) || 0;
    const alt = f[3] ? f[3].split(",").length : 0;
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!(alt >= 1 || pop > 0 || code.startsWith("PPLA") || code === "PPLC")) continue;
    const score = (CODE_WEIGHT[code] ?? 0.5) * 10 + Math.log10(pop + 1) * 3 + Math.min(alt, 20);
    candidates.push({ name, lon, lat, score, alt });
  }

  // Merge near-duplicates: best-known name first, so it absorbs its neighbours.
  candidates.sort((a, b) => b.alt - a.alt || b.score - a.score || a.name.localeCompare(b.name));
  const kept: typeof candidates = [];
  for (const c of candidates) {
    const near = kept.find((k) => distanceKm(k.lat, k.lon, c.lat, c.lon) < MERGE_KM);
    if (near) {
      near.score = Math.max(near.score, c.score);
      continue;
    }
    kept.push({ ...c });
  }
  const places: [string, number, number, number][] = kept.map((k) => [k.name, Number(k.lon.toFixed(4)), Number(k.lat.toFixed(4)), Number(k.score.toFixed(1))]);
  places.sort((a, b) => b[3] - a[3] || a[0].localeCompare(b[0]));
  const out = {
    source: "GeoNames (geonames.org), CC BY 4.0",
    built: new Date().toISOString().slice(0, 10),
    places,
  };
  const text = JSON.stringify(out);
  await writeFile(join(process.cwd(), "lib", "geo-data", "places.json"), text);
  console.log(`places.json: ${places.length} places, ${(text.length / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
