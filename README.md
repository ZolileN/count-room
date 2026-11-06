# Count Room

Live results, a province-stratified projection and council coalition arithmetic for the 2026 South African local government elections (voting day 4 November 2026). Mobile-first, non-commercial and politically neutral.

> Source: Electoral Commission of South Africa (IEC). Provisional until declared.

## What it does

| Page | Data | Notes |
| --- | --- | --- |
| `/` Count | national Lite file | KPIs, national party table, province bars with reporting progress |
| `/projection` | 9 province files | Raw vs projected national share, 90% range, projected province weights |
| `/councils` | national Lite file | All 213 councils; filter by province, status, largest party, type; search |
| `/councils/[id]` | that council's file, on demand | Hemicycle, seats (declared or modelled), coalition calculator, minimal winning coalitions, wards |
| `/metros` | the 8 metro files | Metros at a glance |
| `/method` | none | Plain-language methodology and sources |
| `/api/iec/national`, `/api/iec/munic/[id]` | as above | Trimmed, normalised JSON, cached 60 s at the edge |
| `/api/cron/snapshot` | national + provinces | Vercel Cron every 5 minutes, stores a snapshot in Neon |

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
| `npm test` | Vitest unit tests (models, normaliser, colour contrast) |
| `npm run fetch-fixtures` | Refresh `./fixtures` from the IEC (skips any file fetched in the last 60 s) |
| `npm run fetch-fixtures -- 3003 9006` | Also save extra council files by municipality ID |
| `IEC_SOURCE=live npm run dev` | Develop against the live feed |
| `npm run db:migrate` | Apply `drizzle/` migrations to `DATABASE_URL` |

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | for snapshots | Neon Postgres connection string |
| `CRON_SECRET` | for snapshots | The cron route requires `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it automatically) |
| `IEC_SOURCE` | no | `live` or `fixtures`. Default: `fixtures` in development and tests, `live` in production |
| `SEAT_MODEL` | no | `droop` (default) or `mmp`: the seat model used while a council is still counting |

## Deploy to Vercel

1. Create a Neon database and set `DATABASE_URL` and `CRON_SECRET` in the Vercel project.
2. Run the migration once: `DATABASE_URL=... npm run db:migrate`.
3. Deploy. `vercel.json` pins functions to `cpt1` (Cape Town) and schedules `/api/cron/snapshot` every 5 minutes. Cron frequency below hourly needs a Pro plan; on Hobby, change the schedule or trigger the route yourself.

The build prerenders pages against the live feed (about ten IEC files). To build without touching the IEC, set `IEC_SOURCE=fixtures` for the build.

The app works without a database; you lose the timeline data and the last-resort fallback described below.

## Using the IEC feed

We have no IEC API credentials. We use the public JSON files behind the IEC results dashboard (`https://results.elections.org.za/dashboards/lge/MapsJason`), which are JSON despite the `.js` extension.

Rules this code follows:

- **Server only.** The feed sends no CORS header; the browser never calls it. `lib/iec/client.ts` is the only place that fetches.
- **At most once per 60 s per file.** Each file has its own `unstable_cache` entry (`revalidate: 60`, shared across instances on Vercel) and a per-instance 60 s guard. Pages are ISR with 60 s revalidation and send `s-maxage=60, stale-while-revalidate=60`; the API routes send the same.
- **Honest User-Agent:** `CountRoom/0.1 (non-commercial election results viewer)`.
- **Keep the last good copy.** If the IEC errors, the previous cache entry keeps being served, then this instance's memory, then the latest Neon snapshot (national and province data only). Every page shows when its data is from, and a banner appears when it is stale.
- **Council files only on demand.** A council's file is fetched when its page (or `/metros`, for the 8 metros) is requested, never all 213 in a loop. The API only fetches IDs that exist in the national file.
- **robots.txt:** allows general access and blocks AI-training crawlers (`Content-Signal: ai-train=no`). This app does not train on the data.

### Files used

| File | Size (raw) | Used for |
| --- | --- | --- |
| `2026/EEID1887LiteMapsNational.js` | ~270 KB | National totals, province and council summaries, completion counters |
| `2026/EEID1887Province{1-9}.js` | 110–290 KB each | Province-level party lists for the projection |
| `2026/EEID1887Munic{id}.js` | up to ~3 MB | Full council results, wards, voting districts |
| `2016/PartyList.js` | ~470 KB | Party abbreviations (current despite the path); cached for a day, bundled copy as fallback |

Electoral event IDs, read from the dashboard page on 6 Nov 2026 and kept in `lib/config.ts`: 2026 = 1887, 2021 = 1091, 2016 = 402, 2011 = 197, 2006 = 95, 2000 = 2.

### Feed notes (verified 6 Nov 2026)

Every object is parsed with loose Zod schemas (unknown keys pass through, almost every field optional). Arrays are parsed item by item, so a malformed record is dropped and logged as `[iec drift]` rather than failing the file. Differences from the shape we were originally given:

- **The Lite file truncates party lists below national level.** National lists the top 13 parties plus an `OTHER` row (ID `-2`) that sums to `ValidVotesCast`. Each province lists only its **top 3**, and each council only its **top 1** (2 for metros). The projection therefore uses the nine `EEID1887Province{n}.js` files (each province's top 13 + `OTHER`), and council seats use the council's own file.
- **Each province file has its own top 13.** 31 parties appear in some province's list but not nationally, and some national parties are folded into `OTHER` in some provinces. The projection imputes those from the national residual (see `/method`).
- **Province files lag the Lite file by a few minutes**, and the Lite file's national counters can run ahead of its own nested records (130 vs 129 councils declared in the fixture). The headline uses the counters and the council list uses the records.
- **No `Year2016` or `Year2021` fields.** Only `Year2000`, `Year2006` and `Year2011` exist, so 2021 comparisons need the 2021 files (EEID 1091) or `HistoryYears/`.
- **Extra fields:** `ProvinceID`, `ProvinceExpected`, `MunicExpected`, `WardExpected`, `ProvincesComplete`, `Perc_ProvinceComplete` at every level; `CouncilsWon`, `MajorityWon`, `IsLeadingParty`, `IOrder` on party rows; per-council `HungCouncils` / `MajorityCouncils` / `TotalDrawnCouncils` flags (0 or 1); per-province and per-council `VDsComplete` / `VDExpected`, so no derivation was needed for the projection.
- **While a council is counting, `TotalSeatsWon` is ward seats only.** PR seats appear when the council is declared (`MuncipalitiesComplete` = 1).
- **Votes are ballot sums.** `TotalValidVotes` = ward + PR ballots; `TotalVotesCast` counts ballots, not voters, so a turnout percentage cannot be read off it directly.
- **Ward and voting-district objects** carry party rows with `CandidateName` on the ward ballot. VD rows have only `TotalValidVotes` and no completion flag; we treat a VD with any votes as reported.

## Models

Pure functions in `lib/model/`, unit-tested.

- **Projection** (`projection.ts`): province-stratified re-weighting, 3,000 seeded Monte Carlo draws, 5th/50th/95th percentiles. Runs on the server (about 70 ms) inside the 60 s page cache. One deviation from the brief: a party with exactly zero votes in a province is not perturbed there, so noise cannot create votes for it.
- **Seats** (`seats.ts`): `allocateSeats` is the Droop + largest-remainder approximation on PR votes (default). `allocateMixedMember` is the Schedule 1 compensatory formula with overhang (`SEAT_MODEL=mmp`). On the three declared fixture councils, Droop is within ±1 seat for every party and the Schedule 1 formula is exact.
- **Coalitions** (`coalitions.ts`): minimal winning coalitions of up to 4 of the top 10 parties, with the share of 2,000 council seat simulations in which each reaches the majority line. Independents are excluded from the list (they are individual councillors) but appear in the calculator.

## Fixtures

`fixtures/` holds the national file, the nine province files, the party list, one metro (Nelson Mandela Bay, still counting) and three councils that were declared and hung when captured (Sol Plaatje, Breede Valley, KwaDukuza), all taken at about 12:50 SAST on 6 Nov 2026. In development, councils without a fixture file show their summary from the national file.

## Attribution and neutrality

Data: Electoral Commission of South Africa (IEC), public results dashboard data. Count Room is not affiliated with the IEC. Results are provisional until declared.

Count Room does not endorse any party. Coalition figures are seat arithmetic, not predictions of who will govern. Party colours follow each party's usual colour where one exists, are contrast-tested in both themes, and are always shown alongside the party's name.
