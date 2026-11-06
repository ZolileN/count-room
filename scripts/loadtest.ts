/**
 * Load test: many concurrent visitors against a running Count Room (default http://localhost:3000),
 * mixing full page loads, the client's once-a-minute refreshes (RSC requests), API calls and social
 * preview images. Reports throughput, latency percentiles and errors; with --mock it also reads the
 * mock IEC's request counts and checks the "once per 60 s per file" rule held.
 *
 *   tsx scripts/loadtest.ts --url http://localhost:3000 --concurrency 200 --duration 60 --mock http://localhost:4010
 */
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ""), process.argv[i + 1] ?? "");
const BASE = args.get("url") ?? "http://localhost:3000";
const CONC = Number(args.get("concurrency") ?? 100);
const DURATION_S = Number(args.get("duration") ?? 30);
const MOCK = args.get("mock");

type Req = { path: string; weight: number; rsc?: boolean; kind: string };
const MIX: Req[] = [
  { path: "/", weight: 20, kind: "page" },
  { path: "/", weight: 25, rsc: true, kind: "refresh" },
  { path: "/map", weight: 8, kind: "page" },
  { path: "/projection", weight: 8, kind: "page" },
  { path: "/councils", weight: 6, kind: "page" },
  { path: "/councils/1001", weight: 8, kind: "page" },
  { path: "/councils/1001", weight: 6, rsc: true, kind: "refresh" },
  { path: "/councils/6046", weight: 3, kind: "page" },
  { path: "/councils/3003", weight: 3, kind: "page" }, // no fixture: exercises the fallback path
  { path: "/councils/1001/wards/12", weight: 3, kind: "page" },
  { path: "/metros", weight: 3, kind: "page" },
  { path: "/timeline", weight: 2, kind: "page" },
  { path: "/api/iec/national", weight: 2, kind: "api" },
  { path: "/opengraph-image", weight: 2, kind: "image" },
  { path: "/councils/1001/opengraph-image", weight: 1, kind: "image" },
];
const total = MIX.reduce((a, r) => a + r.weight, 0);
const pick = (): Req => {
  let x = Math.random() * total;
  for (const r of MIX) if ((x -= r.weight) < 0) return r;
  return MIX[0]!;
};

const lat: number[] = [];
const byKind = new Map<string, number[]>();
const statuses = new Map<number, number>();
let errors = 0;
let bytes = 0;

async function worker(until: number) {
  while (Date.now() < until) {
    const r = pick();
    const t0 = performance.now();
    try {
      const res = await fetch(BASE + r.path, { headers: r.rsc ? { RSC: "1" } : {} });
      const buf = await res.arrayBuffer();
      bytes += buf.byteLength;
      statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
      if (res.status >= 500) errors++;
    } catch {
      errors++;
    }
    const ms = performance.now() - t0;
    lat.push(ms);
    (byKind.get(r.kind) ?? byKind.set(r.kind, []).get(r.kind)!).push(ms);
  }
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]! : NaN;
};

async function main() {
  const before = MOCK ? ((await (await fetch(`${MOCK}/__stats`)).json()) as { counts: Record<string, number> }).counts : null;
  console.log(`Load test: ${CONC} concurrent visitors for ${DURATION_S}s against ${BASE}`);
  const t0 = Date.now();
  await Promise.all(Array.from({ length: CONC }, () => worker(t0 + DURATION_S * 1000)));
  const secs = (Date.now() - t0) / 1000;

  console.log(`\nRequests: ${lat.length} in ${secs.toFixed(0)}s = ${(lat.length / secs).toFixed(0)} req/s, ${(bytes / 1e6 / secs).toFixed(1)} MB/s`);
  console.log(`Latency ms: p50 ${pct(lat, 50).toFixed(0)}, p95 ${pct(lat, 95).toFixed(0)}, p99 ${pct(lat, 99).toFixed(0)}, max ${Math.max(...lat).toFixed(0)}`);
  for (const [k, xs] of byKind) console.log(`  ${k.padEnd(8)} n=${String(xs.length).padStart(6)}  p50 ${pct(xs, 50).toFixed(0).padStart(5)}  p95 ${pct(xs, 95).toFixed(0).padStart(5)}`);
  console.log(`Status codes: ${[...statuses].map(([s, n]) => `${s}×${n}`).join(", ")}; errors (5xx or network): ${errors}`);

  let ok = errors === 0;
  if (MOCK && before) {
    const after = ((await (await fetch(`${MOCK}/__stats`)).json()) as { counts: Record<string, number> }).counts;
    const allowed = Math.ceil(secs / 60) + 1;
    console.log(`\nIEC requests during the test (allowed per file: ${allowed} for ${secs.toFixed(0)}s):`);
    for (const [path, n] of Object.entries(after)) {
      const d = n - (before[path] ?? 0);
      if (d === 0) continue;
      const flag = d > allowed ? "  <-- TOO MANY" : "";
      if (d > allowed) ok = false;
      console.log(`  ${String(d).padStart(4)}  ${path.replace(/^.*\/(MapsJason|MapData)\//, "")}${flag}`);
    }
  }
  console.log(ok ? "\nPASS" : "\nFAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
