/**
 * Data assembly for pages and API routes (server only). Each getter returns a result object
 * rather than throwing, so a page can always render something: the data, or a clear notice.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { after } from "next/server";
import { unstable_cache } from "next/cache";
import { dataSource, seatModel } from "./config";
import type { MapGeometry } from "./geo";
import { getMunic, getNational, getPrevious, getProvinces, getWardMap, NotInFixturesError } from "./iec/client";
import type { CouncilSummary, MunicData, NationalData, PreviousCouncil, ProvinceData, Sourced, Ward } from "./iec/types";
import { analyseCouncil, type CouncilAnalysis } from "./model/council";
import { buildProjectionInput } from "./model/inputs";
import { projectNational, type ProjectionResult } from "./model/projection";
import { councilSwing, type CouncilSwing } from "./model/swing";
import { buildSnapshotPayload, type TimelinePoint } from "./snapshot";

export { buildSnapshotPayload };

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    console.error("[data]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function optional<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (!(err instanceof NotInFixturesError)) console.error(`[data] ${label}`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Snapshots without a cron: whenever pages are being rendered from live data, store a snapshot at
// most every five minutes per instance (after the response is sent). The database ignores a
// report it already has. Works on any Vercel plan; the cron route is an extra, not a requirement.

const SNAPSHOT_EVERY_MS = 5 * 60_000;
let lastSnapshotAttempt = 0;

function scheduleSnapshot(): void {
  if (dataSource() !== "live" || !process.env.DATABASE_URL) return;
  if (Date.now() - lastSnapshotAttempt < SNAPSHOT_EVERY_MS) return;
  lastSnapshotAttempt = Date.now();
  try {
    after(async () => {
      try {
        const [n, p] = await Promise.all([getNational(), getProvinces()]);
        if (n.source !== "live" || p.source !== "live") return;
        const { insertSnapshot } = await import("../db/client");
        await insertSnapshot(buildSnapshotPayload(n.data, p.data));
      } catch (err) {
        console.error("[snapshot] opportunistic snapshot failed", err);
      }
    });
  } catch {
    // Outside a request (e.g. some build paths): skip silently.
  }
}

export async function loadNational(): Promise<Result<Sourced<NationalData>>> {
  const r = await attempt(getNational);
  if (r.ok && r.value.source === "live") scheduleSnapshot();
  return r;
}

export interface ProjectionPageData {
  national: Sourced<NationalData>;
  provinces: Sourced<ProvinceData[]>;
  projection: ProjectionResult;
  /** Earliest province report time: the projection is "as of" this. */
  asOf: string;
}

export function loadProjection(): Promise<Result<ProjectionPageData>> {
  return attempt(async () => {
    const [national, provinces] = await Promise.all([getNational(), getProvinces()]);
    if (national.source === "live") scheduleSnapshot();
    const projection = projectNational(buildProjectionInput(national.data, provinces.data));
    const asOf = provinces.data.map((p) => p.reportDate).filter(Boolean).sort()[0] ?? national.data.reportDate;
    return { national, provinces, projection, asOf };
  });
}

// ---------------------------------------------------------------------------------------------
// Councils.

export interface CouncilPageData {
  summary: CouncilSummary;
  national: Sourced<NationalData>;
  /** Full council file and analysis, when available. */
  detail: { munic: Sourced<MunicData>; analysis: CouncilAnalysis } | null;
  /** Why the detail is missing, if it is. */
  detailError: string | null;
  previous: PreviousCouncil | null;
  swing: CouncilSwing | null;
  wardMap: MapGeometry | null;
}

export function findCouncil(nat: NationalData, id: number): CouncilSummary | undefined {
  return nat.councils.find((c) => c.id === id);
}

/** Returns null when the ID is not a council in the national file (caller shows 404). */
export async function loadCouncil(id: number): Promise<Result<CouncilPageData> | null> {
  const nat = await loadNational();
  if (!nat.ok) return nat;
  const summary = findCouncil(nat.value.data, id);
  if (!summary) return null;

  const [munic, prev, map] = await Promise.all([
    getMunic(id).then(
      (m) => ({ ok: true as const, m }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
    optional(() => getPrevious(id), `previous ${id}`),
    optional(() => getWardMap(id), `ward map ${id}`),
  ]);

  if (!munic.ok) {
    const msg =
      munic.err instanceof NotInFixturesError
        ? "This council's ward-level file is not in the local fixtures."
        : "The IEC council file could not be loaded just now. Showing the summary from the national file.";
    if (!(munic.err instanceof NotInFixturesError)) console.error("[data] council", id, munic.err);
    return {
      ok: true,
      value: { summary, national: nat.value, detail: null, detailError: msg, previous: prev?.data ?? null, swing: null, wardMap: map?.data ?? null },
    };
  }
  const m = munic.m;
  return {
    ok: true,
    value: {
      summary,
      national: nat.value,
      detail: { munic: m, analysis: analyseCouncil(m.data, seatModel()) },
      detailError: null,
      previous: prev?.data ?? null,
      swing: prev ? councilSwing(m.data, prev.data) : null,
      wardMap: map?.data ?? null,
    },
  };
}

export interface WardPageData {
  council: MunicData;
  councilSource: Sourced<MunicData>;
  ward: Ward;
  previous: PreviousCouncil | null;
}

/** Null when the council or ward does not exist. */
export async function loadWard(councilId: number, wardNumber: number): Promise<Result<WardPageData> | null> {
  const nat = await loadNational();
  if (!nat.ok) return nat;
  if (!findCouncil(nat.value.data, councilId)) return null;
  const [m, prev] = await Promise.all([
    attempt(() => getMunic(councilId)),
    optional(() => getPrevious(councilId), `previous ${councilId}`),
  ]);
  if (!m.ok) return m;
  const ward = m.value.data.wards.find((w) => w.number === wardNumber);
  if (!ward) return null;
  return { ok: true, value: { council: m.value.data, councilSource: m.value, ward, previous: prev?.data ?? null } };
}

export interface MetroRow {
  summary: CouncilSummary;
  analysis: CouncilAnalysis | null;
  fetchedAt: string | null;
  stale: boolean;
}

export function loadMetros(): Promise<Result<{ national: Sourced<NationalData>; metros: MetroRow[] }>> {
  return attempt(async () => {
    const national = await getNational();
    if (national.source === "live") scheduleSnapshot();
    const metros = national.data.councils.filter((c) => c.kind === "metro");
    const rows = await Promise.all(
      metros.map(async (summary): Promise<MetroRow> => {
        try {
          const m = await getMunic(summary.id);
          // The council file is usually fresher than the national one; keep its summary fields only.
          const { parties: _parties, wards: _wards, ...fresh } = m.data;
          return { summary: fresh, analysis: analyseCouncil(m.data, seatModel()), fetchedAt: m.fetchedAt, stale: m.stale };
        } catch {
          return { summary, analysis: null, fetchedAt: null, stale: true };
        }
      }),
    );
    rows.sort((a, b) => b.summary.totalSeats - a.summary.totalSeats);
    return { national, metros: rows };
  });
}

// ---------------------------------------------------------------------------------------------
// Timeline.

const cachedTimeline = unstable_cache(
  async () => {
    const { timelinePoints } = await import("../db/client");
    return timelinePoints();
  },
  ["timeline", "v1"],
  { revalidate: 120, tags: ["timeline"] },
);

export interface TimelineData {
  points: TimelinePoint[];
  source: "database" | "fixtures" | "none";
}

export function loadTimeline(): Promise<Result<TimelineData>> {
  return attempt(async () => {
    if (dataSource() === "fixtures") {
      try {
        const text = await readFile(join(process.cwd(), "fixtures", "2026", "timeline.jsonl"), "utf8");
        const points = text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as TimelinePoint);
        points.sort((a, b) => a.reportDate.localeCompare(b.reportDate));
        return { points, source: "fixtures" as const };
      } catch {
        return { points: [], source: "none" as const };
      }
    }
    if (!process.env.DATABASE_URL) return { points: [], source: "none" as const };
    return { points: await cachedTimeline(), source: "database" as const };
  });
}
