/**
 * Simplify the IEC's national council boundaries (fixtures/mapdata/nationalMunic.json, fetched with
 * `npm run fetch-fixtures -- --map`) into a content-hashed static file, public/maps/councils.<hash>.json
 * (SVG paths for all 213 councils), which browsers and the CDN cache forever. Its name is recorded
 * in lib/geo-data/map-assets.json.
 *
 *   npm run build-map
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { numProp, toSvgPaths, type GeoFeature } from "../lib/geo";

async function main() {
  const src = join(process.cwd(), "fixtures", "mapdata", "nationalMunic.json");
  const gj = JSON.parse(await readFile(src, "utf8")) as { features: GeoFeature[] };
  const geo = toSvgPaths(gj.features, (f) => numProp(f, "MunicId"), { width: 1000, tolerance: 0.5, precision: 0 });
  const text = JSON.stringify(geo);
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 10);
  const pubDir = join(process.cwd(), "public", "maps");
  await mkdir(pubDir, { recursive: true });
  for (const f of await readdir(pubDir)) if (/^councils\..*\.json$/.test(f)) await unlink(join(pubDir, f));
  const file = `councils.${hash}.json`;
  await writeFile(join(pubDir, file), text);
  const metaDir = join(process.cwd(), "lib", "geo-data");
  await mkdir(metaDir, { recursive: true });
  await writeFile(join(metaDir, "map-assets.json"), JSON.stringify({ councils: `/maps/${file}` }, null, 2) + "\n");
  console.log(`${file}: ${geo.shapes.length} shapes, ${(text.length / 1024).toFixed(0)} KB, viewBox ${geo.viewBox}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
