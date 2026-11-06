/**
 * Refresh the saved IEC files in ./fixtures so tests and local dev never hit the IEC.
 *
 *   npm run fetch-fixtures            # national, 9 provinces, party list, fixture councils
 *   npm run fetch-fixtures -- 3003    # also save extra municipality files by ID
 *
 * Respects the IEC's max-age=60: a file fetched less than 60 s ago (per fixtures/.fetch-log.json)
 * is skipped, and requests are spaced out rather than fired in parallel.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { IEC_MIN_INTERVAL_S, PROVINCE_IDS, USER_AGENT, iecUrls } from "../lib/config";

const ROOT = join(process.cwd(), "fixtures");
const LOG = join(ROOT, ".fetch-log.json");
const GAP_MS = 1500;

/** One metro plus three councils that were declared (and hung) when the fixtures were first taken. */
const DEFAULT_MUNICS = [1001, 6046, 9912, 4457];

type Log = Record<string, number>;

async function readLog(): Promise<Log> {
  try {
    return JSON.parse(await readFile(LOG, "utf8")) as Log;
  } catch {
    return {};
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const extra = process.argv.slice(2).map(Number).filter(Number.isFinite);
  const munics = [...new Set([...DEFAULT_MUNICS, ...extra])];

  const jobs: { url: string; file: string }[] = [
    { url: iecUrls.national(), file: "2026/national.json" },
    ...PROVINCE_IDS.map((p) => ({ url: iecUrls.province(p), file: `2026/province${p}.json` })),
    ...munics.map((m) => ({ url: iecUrls.munic(m), file: `2026/munic${m}.json` })),
    { url: iecUrls.partyList(), file: "partylist.json" },
  ];

  const log = await readLog();
  let fetched = 0;
  for (const job of jobs) {
    const last = log[job.url] ?? 0;
    const age = (Date.now() - last) / 1000;
    if (age < IEC_MIN_INTERVAL_S) {
      console.log(`skip  ${job.file} (fetched ${age.toFixed(0)} s ago; minimum is ${IEC_MIN_INTERVAL_S} s)`);
      continue;
    }
    if (fetched > 0) await sleep(GAP_MS);
    const res = await fetch(job.url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    log[job.url] = Date.now();
    fetched++;
    if (!res.ok) {
      console.error(`fail  ${job.file}: HTTP ${res.status}`);
      continue;
    }
    const text = await res.text();
    try {
      JSON.parse(text);
    } catch {
      console.error(`fail  ${job.file}: response is not JSON`);
      continue;
    }
    const out = join(ROOT, job.file);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, text);
    console.log(`saved ${job.file} (${(text.length / 1024).toFixed(0)} KB)`);
  }
  await writeFile(LOG, JSON.stringify(log, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
