/**
 * Server-side access to the IEC feed. Never import this from a client component: the IEC sends no
 * CORS header, and every request must go through our server so we can cache and rate-limit.
 *
 * Rules (see README, "Using the IEC feed"):
 * - Any given file is fetched at most once per 60 s. Each file has its own `unstable_cache` entry
 *   with revalidate: 60 (shared across instances on Vercel), plus a per-instance guard.
 * - The last good copy is kept. If the IEC errors, `unstable_cache` keeps serving the previous
 *   entry; if there is none, we fall back to this instance's memory, then to the latest Neon
 *   snapshot (national and province data only). Responses say how old the data is.
 * - Municipality files are fetched only when a page for that council is requested.
 */
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { unstable_cache } from "next/cache";
import { CURRENT_EEID, IEC_MIN_INTERVAL_S, PROVINCE_IDS, USER_AGENT, dataSource, iecUrls } from "../config";
import type { PartyLookup } from "../parties";
import { collectDrift } from "./drift";
import { normaliseMunic, normaliseNational, normalisePartyList, normaliseProvince } from "./normalise";
import type { MunicData, NationalData, ProvinceData, Sourced } from "./types";
import type { SnapshotPayload } from "../../db/payload";

/** Data older than this (we failed to refresh it) is flagged as stale in the UI. */
export const STALE_AFTER_MS = 3 * IEC_MIN_INTERVAL_S * 1000;
const TIMEOUT_MS = 15_000;

interface Entry<T> {
  data: T;
  fetchedAt: string;
  warnings: string[];
}

export class FeedUnavailableError extends Error {
  constructor(what: string, cause?: unknown) {
    super(`IEC ${what} unavailable${cause instanceof Error ? `: ${cause.message}` : ""}`);
    this.name = "FeedUnavailableError";
  }
}

export class NotInFixturesError extends Error {
  constructor(file: string) {
    super(`${file} is not in ./fixtures (run with IEC_SOURCE=live, or npm run fetch-fixtures -- <id>)`);
    this.name = "NotInFixturesError";
  }
}

const memory = new Map<string, Entry<unknown>>();

async function fetchIecJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/javascript;q=0.9" },
    cache: "no-store", // caching is done by unstable_cache around this call
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  return JSON.parse(text.replace(/^﻿/, "")) as unknown;
}

async function readFixture(file: string): Promise<{ json: unknown; mtime: string }> {
  const path = join(process.cwd(), "fixtures", file);
  try {
    const [text, st] = await Promise.all([readFile(path, "utf8"), stat(path)]);
    return { json: JSON.parse(text) as unknown, mtime: st.mtime.toISOString() };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new NotInFixturesError(file);
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// Party list (abbreviations). Changes rarely: cached for a day, bundled fixture as fallback.

let lookupMemo: PartyLookup | null = null;

const cachedPartyList = unstable_cache(
  async (): Promise<[number, string, string][]> => {
    const lookup = normalisePartyList(await fetchIecJson(iecUrls.partyList()));
    return [...lookup].map(([id, v]) => [id, v.abbr, v.full]);
  },
  ["iec", "party-list", "v1"],
  { revalidate: 86_400, tags: ["iec", "party-list"] },
);

async function fixturePartyLookup(): Promise<PartyLookup> {
  const { json } = await readFixture("partylist.json");
  return normalisePartyList(json);
}

export async function getPartyLookup(): Promise<PartyLookup> {
  if (lookupMemo) return lookupMemo;
  let lookup: PartyLookup;
  if (dataSource() === "fixtures") {
    lookup = await fixturePartyLookup();
  } else {
    try {
      const rows = await cachedPartyList();
      lookup = new Map(rows.map(([id, abbr, full]) => [id, { abbr, full }]));
    } catch (err) {
      console.error("[iec] party list unavailable; using bundled copy", err);
      lookup = await fixturePartyLookup();
    }
  }
  lookupMemo = lookup;
  return lookup;
}

// ---------------------------------------------------------------------------------------------
// Generic loader: one cached entry per IEC file.

interface LoaderSpec<T> {
  key: string;
  url: string;
  fixture: string;
  normalise: (json: unknown, lookup: PartyLookup) => T;
}

function makeLoader<T>(spec: LoaderSpec<T>) {
  const load = async (): Promise<Entry<T>> => {
    // Per-instance guard: never refetch a file this instance fetched in the last 60 s.
    const prev = memory.get(spec.key) as Entry<T> | undefined;
    if (prev && Date.now() - Date.parse(prev.fetchedAt) < IEC_MIN_INTERVAL_S * 1000) return prev;
    const lookup = await getPartyLookup();
    const json = await fetchIecJson(spec.url);
    const { value, warnings } = collectDrift(() => spec.normalise(json, lookup));
    const entry: Entry<T> = { data: value, fetchedAt: new Date().toISOString(), warnings };
    memory.set(spec.key, entry);
    return entry;
  };
  const cached = unstable_cache(load, ["iec", String(CURRENT_EEID), spec.key, "v1"], {
    revalidate: IEC_MIN_INTERVAL_S,
    tags: ["iec", `iec:${spec.key}`],
  });

  return async (): Promise<Sourced<T>> => {
    if (dataSource() === "fixtures") {
      const { json, mtime } = await readFixture(spec.fixture);
      const lookup = await getPartyLookup();
      const { value, warnings } = collectDrift(() => spec.normalise(json, lookup));
      return { data: value, fetchedAt: mtime, stale: false, source: "fixtures", warnings };
    }
    try {
      const e = await cached();
      if (!memory.has(spec.key)) memory.set(spec.key, e);
      const stale = Date.now() - Date.parse(e.fetchedAt) > STALE_AFTER_MS;
      return { ...e, stale, source: "live" };
    } catch (err) {
      console.error(`[iec] ${spec.key} fetch failed`, err);
      const m = memory.get(spec.key) as Entry<T> | undefined;
      if (m) return { ...m, stale: true, source: "memory" };
      throw new FeedUnavailableError(spec.key, err);
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Public getters.

const nationalLoader = makeLoader<NationalData>({
  key: "national",
  url: iecUrls.national(),
  fixture: "2026/national.json",
  normalise: normaliseNational,
});

const provinceLoaders = new Map(
  PROVINCE_IDS.map((id) => [
    id,
    makeLoader<ProvinceData>({
      key: `province-${id}`,
      url: iecUrls.province(id),
      fixture: `2026/province${id}.json`,
      normalise: normaliseProvince,
    }),
  ]),
);

const municLoaders = new Map<number, () => Promise<Sourced<MunicData>>>();

/** Last resort when the IEC is down and this instance has nothing in memory. */
async function fromSnapshot<T>(pick: (p: SnapshotPayload) => T): Promise<Sourced<T> | null> {
  const { latestSnapshot } = await import("../../db/client");
  const snap = await latestSnapshot();
  if (!snap) return null;
  return { data: pick(snap.payload), fetchedAt: snap.takenAt.toISOString(), stale: true, source: "snapshot", warnings: [] };
}

/** National Lite file: national, province and per-council summaries. */
export async function getNational(): Promise<Sourced<NationalData>> {
  try {
    return await nationalLoader();
  } catch (err) {
    if (!(err instanceof FeedUnavailableError)) throw err;
    const snap = await fromSnapshot((p) => p.national);
    if (snap) return snap;
    throw err;
  }
}

/** The nine province files (full province-level party lists, used by the projection). */
export async function getProvinces(): Promise<Sourced<ProvinceData[]>> {
  try {
    const all = await Promise.all(PROVINCE_IDS.map((id) => provinceLoaders.get(id)!()));
    return {
      data: all.map((s) => s.data),
      fetchedAt: all.map((s) => s.fetchedAt).sort()[0] ?? new Date(0).toISOString(),
      stale: all.some((s) => s.stale),
      source: all.find((s) => s.source !== "live")?.source ?? all[0]?.source ?? "live",
      warnings: [...new Set(all.flatMap((s) => s.warnings))],
    };
  } catch (err) {
    if (!(err instanceof FeedUnavailableError)) throw err;
    const snap = await fromSnapshot((p) => p.provinces);
    if (snap) return snap;
    throw err;
  }
}

/**
 * One municipality file (wards, voting districts, full party list). Callers must check the ID
 * against the national council list first, so we never fetch arbitrary files.
 */
export async function getMunic(id: number): Promise<Sourced<MunicData>> {
  let loader = municLoaders.get(id);
  if (!loader) {
    loader = makeLoader<MunicData>({
      key: `munic-${id}`,
      url: iecUrls.munic(id),
      fixture: `2026/munic${id}.json`,
      normalise: normaliseMunic,
    });
    municLoaders.set(id, loader);
  }
  return loader();
}
