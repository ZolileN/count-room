/** Single source for the product name (title, metadata, footer). */
export const APP_NAME = "Count Room";

export const APP_DESCRIPTION =
  "Live count, province-stratified projection and council seat arithmetic for the 2026 South African local government elections.";

/** Public site URL for share links and preview images. Vercel sets VERCEL_PROJECT_PRODUCTION_URL. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Who built it (footer credit). */
export const DEVELOPER = { name: "Zolile Nonzapa", url: "https://dev.mlkcomputer.com/" } as const;

export const SOURCE_LINE = "Source: Electoral Commission of South Africa (IEC). Provisional until declared.";

/** Honest User-Agent for every request we make to the IEC. */
export const USER_AGENT = "CountRoom/0.1 (non-commercial election results viewer)";

/**
 * IEC data hosts. Overridable only so the load test can point the app at a local mock of the IEC
 * (scripts/mock-iec.ts); production always uses the real hosts.
 */
export const IEC_BASE = process.env.IEC_BASE_URL ?? "https://results.elections.org.za/dashboards/lge/MapsJason";
export const IEC_MAP_BASE = process.env.IEC_MAP_BASE_URL ?? "https://results.elections.org.za/ElectionMap/MapData";

/** Year of the boundaries the IEC publishes for the 2026 wards. */
export const BOUNDARY_YEAR = 2026;
/** The previous local election, for swing. */
export const PREVIOUS_YEAR = 2021 as const;

/**
 * Electoral event IDs (EEIDs) for local government elections, as declared in the IEC results
 * dashboard page (https://results.elections.org.za/dashboards/lge/, inline `var EEID2021 = ...`).
 * Read on 6 Nov 2026.
 */
export const EEID = {
  2026: 1887,
  2021: 1091,
  2016: 402,
  2011: 197,
  2006: 95,
  2000: 2,
} as const;

export const CURRENT_YEAR = 2026 as const;
export const CURRENT_EEID = EEID[CURRENT_YEAR];

/** The IEC sends max-age=60. We never refetch any file faster than this. */
export const IEC_MIN_INTERVAL_S = 60;

/** Voting day, for copy. */
export const VOTING_DAY = "2026-11-04";

export const TIME_ZONE = "Africa/Johannesburg";

export const iecUrls = {
  national: (year: number = CURRENT_YEAR) => `${IEC_BASE}/${year}/EEID${eeidFor(year)}LiteMapsNational.js`,
  province: (provinceId: number, year: number = CURRENT_YEAR) =>
    `${IEC_BASE}/${year}/EEID${eeidFor(year)}Province${provinceId}.js`,
  munic: (municipalityId: number, year: number = CURRENT_YEAR) =>
    `${IEC_BASE}/${year}/EEID${eeidFor(year)}Munic${municipalityId}.js`,
  party: (partyId: number, year: number = CURRENT_YEAR) =>
    `${IEC_BASE}/${year}/EEID${eeidFor(year)}Party${partyId}.js`,
  partyList: () => `${IEC_BASE}/2016/PartyList.js`,
  wardHistory: (wardId: number) => `${IEC_BASE}/HistoryYears/WD${wardId}.js`,
  wardVdHistory: (wardId: number) => `${IEC_BASE}/HistoryYears/WDVDs${wardId}.js`,
  municHistory: (municipalityId: number) => `${IEC_BASE}/HistoryYears/M${municipalityId}.js`,
  /** GeoJSON: every council's boundary (large; we simplify it once into public/). */
  nationalMunicMap: (year: number = BOUNDARY_YEAR) => `${IEC_MAP_BASE}/${year}/nationalMunic.js`,
  /** GeoJSON: one council's ward boundaries. */
  wardMap: (municipalityId: number, year: number = BOUNDARY_YEAR) => `${IEC_MAP_BASE}/${year}/municward${municipalityId}.js`,
};

function eeidFor(year: number): number {
  const id = (EEID as Record<number, number>)[year];
  if (id === undefined) throw new Error(`No EEID configured for ${year}`);
  return id;
}

export const PROVINCE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const METRO_IDS = [1001, 1117, 2207, 3002, 3003, 3004, 4005, 9006] as const;

export type DataSource = "live" | "fixtures";

export function dataSource(): DataSource {
  const v = process.env.IEC_SOURCE;
  if (v === "live" || v === "fixtures") return v;
  return process.env.NODE_ENV === "production" ? "live" : "fixtures";
}

export type SeatModel = "droop" | "mmp";

export function seatModel(): SeatModel {
  return process.env.SEAT_MODEL === "mmp" ? "mmp" : "droop";
}
