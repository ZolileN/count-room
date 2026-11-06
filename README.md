# Count Room

Live results, a province-stratified projection, maps, 2021 comparison and council coalition arithmetic for the 2026 South African local government elections (voting day 4 November 2026). Mobile-first, non-commercial and politically neutral.

> Source: Electoral Commission of South Africa (IEC). Provisional until declared.

## What it does

| Page | Data | Notes |
| --- | --- | --- |
| `/` Count | national Lite file | KPIs, national party table, province bars with reporting progress |
| `/map`, `/map/[province]` | national Lite file + static boundaries | Every council coloured by largest/leading party, hung councils hatched; tap through |
| `/projection` | 9 province files | Raw vs projected national share, 90% range, projected province weights |
| `/councils` | national Lite file | All 213 councils; filter by province, status, largest party, type; search; filters in the URL |
| `/councils/[id]` | that council's 2026 + 2021 files, ward boundaries | Hemicycle, seats, coalition calculator, minimal winning coalitions, ward map (winners / swing), change since 2021, biggest swings, closest wards, ward table |
| `/councils/[id]/wards/[n]` | same | Ward ballot, votes needed, change since 2021, voting districts |
| `/metros` | the 8 metro files | Metros at a glance |
| `/timeline` | stored snapshots | Projection, raw count, districts reported and declared councils through the night |
| `/ask` | everything above | AI analyst (off unless configured; see below) |
| `/method` | none | Methodology, sources, privacy |
| `/api/iec/national`, `/api/iec/munic/[id]`, `/api/map/wards/[id]` | as above | Trimmed JSON, edge-cached |
| `/api/cron/snapshot` | national + provinces | Optional; snapshots are also taken automatically (below) |

Every page has a live social preview image (`/opengraph-image`, and one per council), a Share button (phone share sheet, WhatsApp, X, Facebook, copy link), and is in `/sitemap.xml`.

## Setup

Requires Node 20.9+.

```bash
npm install
cp .env.example .env.local   # optional for local dev
npm run dev                  # http://localhost:3000, uses ./fixtures, never calls the IEC
```

| Command | What it does |
| --- | --- |
| `npm run check` | typecheck + lint + tests |
| `npm test` | Vitest unit tests (models, normaliser, swing, AI guard rails, colour contrast) |
| `npm run fetch-fixtures` | Refresh `./fixtures` from the IEC (skips any file fetched in the last 60 s) |
| `npm run fetch-fixtures -- 3003 --map` | Also save council 3003 and the raw national boundaries |
| `npm run build-map` | Simplify the national boundaries into `public/maps/councils.<hash>.json` |
| `npm run build-places -- ZA.txt` | Rebuild `lib/geo-data/places.json` (ward-map town names) from the GeoNames ZA dump |
| `npm run capture-snapshot` | Append one real timeline point (from the live IEC) to `fixtures/2026/timeline.jsonl` |
| `npm run mock-iec` / `npm run loadtest` | Load testing against a local mock of the IEC (see below) |
| `npm run db:migrate` | Apply `drizzle/` migrations to `DATABASE_URL` |

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | recommended | Neon Postgres: timeline snapshots, last-good fallback, AI daily cap |
| `CRON_SECRET` | for the cron route | `/api/cron/snapshot` requires `Authorization: Bearer $CRON_SECRET` |
| `NEXT_PUBLIC_SITE_URL` | with a custom domain | Absolute URL for share links and preview images (defaults to the Vercel production domain) |
| `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | for analytics | Cloudflare Web Analytics site token |
| `ANTHROPIC_API_KEY` | for `/ask` | Switches the AI analyst on. **Paid per request.** |
| `NEXT_PUBLIC_AI_ENABLED` | with the key | `1` shows "Ask" in the navigation |
| `AI_DAILY_LIMIT` | no | Site-wide cap on new AI answers per day (default 300) |
| `IEC_SOURCE` | no | `live` or `fixtures`. Default: `fixtures` in development, `live` in production |
| `SEAT_MODEL` | no | `droop` (default) or `mmp`: seat model while a council is still counting |

## Deploy to Vercel

1. Create a Neon database (free tier is enough) and set `DATABASE_URL` in the Vercel project. Run `DATABASE_URL=... npm run db:migrate` once.
2. Optionally set `CRON_SECRET`, `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`, and the AI variables.
3. Deploy. `vercel.json` pins functions to `cpt1` (Cape Town).

**Snapshots without a 5-minute cron.** Vercel's Hobby plan rejects crons that run more than once a day, so snapshots don't depend on one: whenever pages are rendered from live data, the app stores a snapshot at most every five minutes per instance, after the response is sent, and the database ignores IEC reports it already has. `vercel.json` has a daily cron as a safety net. On Pro, change its schedule to `*/5 * * * *`; on any plan you can also point a free external scheduler (for example cron-job.org) at `/api/cron/snapshot` with the bearer header.

**Storage.** Each snapshot row is a ~2 KB timeline point; the full ~170 KB payload is kept only once, in `latest_snapshot`, as the last-good copy. A night of five-minute snapshots is well under 1 MB.

The build prerenders pages against the live feed (about ten IEC files). To build without touching the IEC, set `IEC_SOURCE=fixtures` for the build.

## Before you share it

- Set `NEXT_PUBLIC_SITE_URL` if you use a custom domain, so link previews point at it.
- Paste a page into the [X card validator](https://cards-dev.twitter.com/validator) or Facebook's sharing debugger to warm the preview images.
- Open `/` and `/councils/1001` on a phone and check the share button.
- Analytics: in Cloudflare, Analytics & Logs > Web Analytics > Add a site, choose the JavaScript snippet, copy the token into `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`, redeploy. It is free with no traffic cap, sets no cookies, and needs no consent banner. Dashboard: page views, visitors, referrers (which social posts send traffic), countries, devices.

## Traffic and load testing

Designed so a viral post cannot overload the app or the IEC:

- Every page is ISR with `s-maxage=60, stale-while-revalidate=60`, so the CDN serves almost all traffic and the server renders each page about once a minute. The client's minute refresh fetches the same cached payload.
- Each IEC file has one shared cache entry (`revalidate: 60`); concurrent misses on an instance share one request (coalescing); a failed file is not retried for 60 s; the party list is memoised.
- Map boundaries are static files (`public/maps/`, cached forever) or day-cached API responses, so page refreshes carry only colours. First load: Count 15 KB, Map 11 KB + 52 KB boundaries once, a metro council 36 KB (gzipped).

To test, run a local mock of the IEC (it serves `./fixtures` at the IEC's paths and counts requests), build and start the app against it, then load it:

```bash
npm run mock-iec &                                    # http://localhost:4010
export IEC_SOURCE=live IEC_BASE_URL=http://localhost:4010/dashboards/lge/MapsJason \
       IEC_MAP_BASE_URL=http://localhost:4010/ElectionMap/MapData
npm run build && PORT=3123 npm start &
npm run loadtest -- --url http://localhost:3123 --concurrency 200 --duration 150 --mock http://localhost:4010
```

The test mixes page loads, minute refreshes (RSC requests), API calls and preview images, includes a council whose file is missing (to exercise the fallback), and **fails if any IEC file is requested more than once a minute**. Results on a 4-core laptop, one Node process, no CDN, load generator on the same machine (6 Nov 2026):

| Scenario | Requests | Throughput | Latency p50 / p95 | Errors | IEC rule |
| --- | --- | --- | --- | --- | --- |
| 200 visitors, 150 s, cold start | 37,010 | 246 req/s | 738 / 1,202 ms (queueing) | 0 | pass: each file ≤ 3 requests |
| 50 visitors, 30 s | 7,701 | 256 req/s | 187 / 317 ms | 0 | pass |

One process with no CDN sustains about 15,000 page views a minute; on Vercel the CDN serves cached pages, so origin load stays at roughly one render per page per minute regardless of visitors. Never point the load test at the real IEC.

## AI analyst

`/ask` answers questions from the data the site shows, using Claude (`claude-opus-5-5`, low effort, server-side only). It is **off unless `ANTHROPIC_API_KEY` is set**, because each new answer costs money (roughly US$0.02–0.05). Controls: 6 questions per visitor per 10 minutes, a site-wide daily cap (`AI_DAILY_LIMIT`, counted in Neon, default 300 ≈ under US$15/day), identical questions on the same data served from cache, prompt caching on the data block, and short answers. The model is instructed to use only the supplied figures, cite them, and refuse predictions or partisanship. Refusals fall back server-side (`fallbacks: "default"`).

## Using the IEC feed

We have no IEC API credentials. We use the public JSON files behind the IEC results dashboard (`https://results.elections.org.za/dashboards/lge/MapsJason` and `.../ElectionMap/MapData`), which are JSON despite the `.js` extension.

- **Server only.** The feed sends no CORS header; the browser never calls it. `lib/iec/client.ts` is the only place that fetches.
- **At most once per 60 s per file**, including failures (see above). Static files (2021 results, boundaries, party list) are cached for a day.
- **Honest User-Agent:** `CountRoom/0.1 (non-commercial election results viewer)`.
- **Keep the last good copy:** previous cache entry, then instance memory, then the Neon `latest_snapshot`. Pages show when their data is from and a banner when it is stale.
- **Council files only on demand.** The API only fetches IDs that exist in the national file.
- **robots.txt** allows general access and sets `Content-Signal: ai-train=no`. Count Room does not train models on the data; the AI analyst uses it as input to answer questions (the IEC's signal does not address that use).

### Files used

| File | Size (raw) | Used for |
| --- | --- | --- |
| `2026/EEID1887LiteMapsNational.js` | ~270 KB | National totals, province and council summaries, completion counters |
| `2026/EEID1887Province{1-9}.js` | 110–290 KB each | Province-level party lists for the projection |
| `2026/EEID1887Munic{id}.js` | up to ~3 MB | Full council results, wards, voting districts |
| `2021/EEID1091Munic{id}.js` | up to ~1.6 MB | 2021 results per voting district, for swing |
| `ElectionMap/MapData/2026/municward{id}.js` | 80–250 KB | 2026 ward boundaries (GeoJSON) |
| `ElectionMap/MapData/2026/nationalMunic.js` | ~9.7 MB | Council boundaries; simplified once at build time, not fetched at runtime |
| `2016/PartyList.js` | ~470 KB | Party abbreviations (current despite the path) |

Electoral event IDs, read from the dashboard page on 6 Nov 2026 and kept in `lib/config.ts`: 2026 = 1887, 2021 = 1091, 2016 = 402, 2011 = 197, 2006 = 95, 2000 = 2.

### Feed notes (verified 6 Nov 2026)

Every object is parsed with loose Zod schemas (unknown keys pass through, almost every field optional). Arrays are parsed item by item, so a malformed record is dropped and logged as `[iec drift]` rather than failing the file.

- **The Lite file truncates party lists below national level**: national lists the top 13 + `OTHER` (ID `-2`); provinces the top 3; councils the top 1 (2 for metros). Hence the province files for the projection and council files for seats.
- **Each province file has its own top 13**; national parties folded into a province's `OTHER` are imputed from the national residual.
- **Province files lag the Lite file by a few minutes**, and the Lite file's national counters can run ahead of its own nested records.
- **No `Year2016` or `Year2021` fields**; 2021 comes from the 2021 council files.
- **`HistoryYears/WD{ward}.js` is unusable** (repeated placeholder rows). `HistoryYears/M{id}.js` has ward shares for 2000–2021 keyed by each year's ward IDs, which don't map onto 2026 boundaries; we use voting districts instead.
- **Voting-district IDs are mostly stable** (Nelson Mandela Bay: 230 of 268 in the same ward as 2021, 22 moved ward, 16 new), which makes the matched-district swing possible.
- **`CandidateName` is `"-"`** for every candidate except declared ward winners.
- **While a council is counting, `TotalSeatsWon` is ward seats only.** PR seats appear at declaration.
- **Votes are ballot sums.** `TotalValidVotes` = ward + PR ballots; `TotalVotesCast` counts ballots, not voters. No registered-voter figure per ward, so no ward turnout.
- **2026 boundaries are published** under `MapData/2026/` and are keyed by the 2026 ward ID (`PklWardID`).

## Models

Pure functions in `lib/model/`, unit-tested.

- **Projection** (`projection.ts`): province-stratified re-weighting, 3,000 seeded Monte Carlo draws, 5th/50th/95th percentiles. A party with zero votes in a province is not perturbed there.
- **Seats** (`seats.ts`): Droop + largest remainder on PR votes (default) and the Schedule 1 compensatory formula (`SEAT_MODEL=mmp`), which reproduces the three declared fixture councils exactly; Droop is within ±1 seat.
- **Coalitions** (`coalitions.ts`): minimal winning coalitions of up to 4 of the top 10 parties, with the share of 2,000 council seat simulations reaching the majority line.
- **Swing** (`swing.ts`): matched-voting-district comparison with 2021, biggest swings, votes needed and closest wards.

## Fixtures

`fixtures/` holds the national file, nine province files, the party list, one metro (Nelson Mandela Bay, still counting) and three councils declared when captured (Sol Plaatje, Breede Valley, KwaDukuza), their 2021 files and ward boundaries, and `2026/timeline.jsonl`: real timeline points captured from the live feed on 6 Nov 2026.

## Attribution and neutrality

Data: Electoral Commission of South Africa (IEC), public results dashboard data; boundaries from the IEC / Municipal Demarcation Board; place names on ward maps from [GeoNames](https://www.geonames.org/) (CC BY 4.0), filtered to ~2,700 notable places and merged within 2.5 km. Count Room is not affiliated with the IEC. Results are provisional until declared.

Count Room does not endorse any party. Coalition figures are seat arithmetic, not predictions of who will govern. Party colours follow each party's usual colour where one exists, are contrast-tested in both themes, and are always shown alongside the party's name.
