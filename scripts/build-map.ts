/**
 * Simplify the IEC's national council boundaries (fixtures/mapdata/nationalMunic.json, fetched with
 * `npm run fetch-fixtures -- --map`) into lib/geo-data/councils.json: SVG paths for all 213
 * councils, small enough to ship in the page.
 *
 *   npm run build-map
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { numProp, toSvgPaths, type GeoFeature } from "../lib/geo";

async function main() {
  const src = join(process.cwd(), "fixtures", "mapdata", "nationalMunic.json");
  const gj = JSON.parse(await readFile(src, "utf8")) as { features: GeoFeature[] };
  const geo = toSvgPaths(gj.features, (f) => numProp(f, "MunicId"), { width: 1000, tolerance: 0.5, precision: 0 });
  const outDir = join(process.cwd(), "lib", "geo-data");
  await mkdir(outDir, { recursive: true });
  const text = JSON.stringify(geo);
  await writeFile(join(outDir, "councils.json"), text);
  console.log(`councils.json: ${geo.shapes.length} shapes, ${(text.length / 1024).toFixed(0)} KB, viewBox ${geo.viewBox}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
