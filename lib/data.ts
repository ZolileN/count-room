/**
 * Data assembly for pages and API routes (server only). Each getter returns a result object
 * rather than throwing, so a page can always render something: the data, or a clear notice.
 */
import { seatModel } from "./config";
import { getMunic, getNational, getProvinces, NotInFixturesError } from "./iec/client";
import type { CouncilSummary, MunicData, NationalData, ProvinceData, Sourced } from "./iec/types";
import { analyseCouncil, type CouncilAnalysis } from "./model/council";
import { buildProjectionInput } from "./model/inputs";
import { projectNational, type ProjectionResult } from "./model/projection";
import type { SnapshotPayload } from "../db/payload";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    console.error("[data]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function loadNational(): Promise<Result<Sourced<NationalData>>> {
  return attempt(getNational);
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
    const projection = projectNational(buildProjectionInput(national.data, provinces.data));
    const asOf = provinces.data.map((p) => p.reportDate).filter(Boolean).sort()[0] ?? national.data.reportDate;
    return { national, provinces, projection, asOf };
  });
}

export interface CouncilPageData {
  summary: CouncilSummary;
  national: Sourced<NationalData>;
  /** Full council file and analysis, when available. */
  detail: { munic: Sourced<MunicData>; analysis: CouncilAnalysis } | null;
  /** Why the detail is missing, if it is. */
  detailError: string | null;
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
  try {
    const munic = await getMunic(id);
    return { ok: true, value: { summary, national: nat.value, detail: { munic, analysis: analyseCouncil(munic.data, seatModel()) }, detailError: null } };
  } catch (err) {
    const msg = err instanceof NotInFixturesError
      ? "This council's ward-level file is not in the local fixtures."
      : "The IEC council file could not be loaded just now. Showing the summary from the national file.";
    if (!(err instanceof NotInFixturesError)) console.error("[data] council", id, err);
    return { ok: true, value: { summary, national: nat.value, detail: null, detailError: msg } };
  }
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

export function buildSnapshotPayload(national: NationalData, provinces: ProvinceData[]): SnapshotPayload {
  let projection: SnapshotPayload["projection"] = null;
  try {
    projection = projectNational(buildProjectionInput(national, provinces)).parties.map((p) => ({
      id: p.id,
      raw: round(p.raw),
      projected: round(p.projected),
      p5: round(p.p5),
      p95: round(p.p95),
    }));
  } catch (err) {
    console.error("[snapshot] projection failed", err);
  }
  return { version: 1, national, provinces, projection };
}

const round = (x: number) => Math.round(x * 1000) / 1000;
