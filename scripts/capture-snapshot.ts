/**
 * Append one real timeline point to fixtures/2026/timeline.jsonl from the live IEC feed, so local
 * development has a genuine count history to draw. Skips a report already captured, and respects
 * the 60 s rule via fixtures/.fetch-log.json (shared with fetch-fixtures).
 *
 *   npm run capture-snapshot
 */
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { IEC_MIN_INTERVAL_S, PROVINCE_IDS, USER_AGENT, iecUrls } from "../lib/config";
import { normaliseNational, normalisePartyList, normaliseProvince } from "../lib/iec/normalise";
import { buildSnapshotPayload, timelinePoint, type TimelinePoint } from "../lib/snapshot";

const ROOT = join(process.cwd(), "fixtures");
const LOG = join(ROOT, ".fetch-log.json");
const OUT = join(ROOT, "2026", "timeline.jsonl");

async function main() {
  let log: Record<string, number> = {};
  try {
    log = JSON.parse(await readFile(LOG, "utf8"));
  } catch {}
  const urls = [iecUrls.national(), ...PROVINCE_IDS.map((p) => iecUrls.province(p))];
  const recent = urls.find((u) => Date.now() - (log[u] ?? 0) < IEC_MIN_INTERVAL_S * 1000);
  if (recent) {
    console.log(`skip: ${recent} was fetched less than ${IEC_MIN_INTERVAL_S} s ago`);
    return;
  }
  const json: unknown[] = [];
  for (const u of urls) {
    const res = await fetch(u, { headers: { "User-Agent": USER_AGENT } });
    log[u] = Date.now();
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${u}`);
    json.push(JSON.parse(await res.text()));
    await new Promise((r) => setTimeout(r, 500));
  }
  await writeFile(LOG, JSON.stringify(log, null, 2));

  const lookup = normalisePartyList(JSON.parse(await readFile(join(ROOT, "partylist.json"), "utf8")));
  const national = normaliseNational(json[0], lookup);
  const provinces = json.slice(1).map((j) => normaliseProvince(j, lookup));

  let existing: TimelinePoint[] = [];
  try {
    existing = (await readFile(OUT, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as TimelinePoint);
  } catch {}
  if (existing.some((p) => p.reportDate === national.reportDate)) {
    console.log(`skip: report ${national.reportDate} already captured`);
    return;
  }
  const point = timelinePoint(buildSnapshotPayload(national, provinces), new Date().toISOString());
  await appendFile(OUT, JSON.stringify(point) + "\n");
  console.log(`captured ${point.reportDate}: ${point.vdsComplete}/${point.vdsExpected} VDs, ${point.declared} declared`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
