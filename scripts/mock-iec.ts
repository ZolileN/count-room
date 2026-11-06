/**
 * A local stand-in for the IEC results files, for load testing. Serves ./fixtures at the IEC's
 * paths with a realistic delay, and counts every request per file so the load test can check that
 * Count Room never asks for the same file more than about once a minute, however busy it gets.
 *
 *   tsx scripts/mock-iec.ts            # http://localhost:4010
 *   GET /__stats                       # request counts per path
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 250);
const FX = join(process.cwd(), "fixtures");
const counts = new Map<string, number>();
const started = Date.now();

function fixtureFor(path: string): string | null {
  let m: RegExpMatchArray | null;
  if ((m = path.match(/MapsJason\/2026\/EEID1887LiteMapsNational\.js$/))) return "2026/national.json";
  if ((m = path.match(/MapsJason\/2026\/EEID1887Province(\d)\.js$/))) return `2026/province${m[1]}.json`;
  if ((m = path.match(/MapsJason\/(2026|2021)\/EEID(?:1887|1091)Munic(\d+)\.js$/))) return `${m[1]}/munic${m[2]}.json`;
  if (path.endsWith("MapsJason/2016/PartyList.js")) return "partylist.json";
  if ((m = path.match(/MapData\/2026\/municward(\d+)\.js$/))) return `mapdata/municward${m[1]}.json`;
  return null;
}

createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0]!;
  if (path === "/__stats") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ uptimeS: Math.round((Date.now() - started) / 1000), counts: Object.fromEntries(counts) }));
    return;
  }
  counts.set(path, (counts.get(path) ?? 0) + 1);
  await new Promise((r) => setTimeout(r, DELAY_MS));
  const f = fixtureFor(path);
  if (!f) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(join(FX, f));
    res.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "max-age=60" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT, () => console.log(`mock IEC on http://localhost:${PORT}`));
