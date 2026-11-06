/** Builds the payload stored for each snapshot. Pure: no Next.js or network imports. */
import type { NationalData, ProvinceData } from "./iec/types";
import { buildProjectionInput } from "./model/inputs";
import { projectNational } from "./model/projection";
import type { SnapshotPayload } from "../db/payload";

const round = (x: number) => Math.round(x * 1000) / 1000;

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

/** One point on the count timeline: small enough to keep hundreds in memory and in fixtures. */
export interface TimelinePoint {
  takenAt: string;
  reportDate: string;
  vdsComplete: number;
  vdsExpected: number;
  declared: number;
  hung: number;
  majority: number;
  /** Raw national share by party ID, percentage points (IEC PercOfVotes). */
  raw: Record<number, number>;
  /** Projected national share by party ID, with 90% range. */
  projected: Record<number, { p: number; lo: number; hi: number }> | null;
}

export function timelinePoint(payload: SnapshotPayload, takenAt: string): TimelinePoint {
  const n = payload.national;
  return {
    takenAt,
    reportDate: n.reportDate,
    vdsComplete: n.progress.vdsComplete,
    vdsExpected: n.progress.vdsExpected,
    declared: n.progress.municsComplete,
    hung: n.hung,
    majority: n.majority,
    raw: Object.fromEntries(n.parties.map((p) => [p.id, round(p.pct)])),
    projected: payload.projection
      ? Object.fromEntries(payload.projection.map((p) => [p.id, { p: p.projected, lo: p.p5, hi: p.p95 }]))
      : null,
  };
}
