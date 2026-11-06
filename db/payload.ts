import type { NationalData, ProvinceData } from "../lib/iec/types";

/** What a snapshot stores: the normalised national and province data, plus the projection summary. */
export interface SnapshotPayload {
  version: 1;
  national: NationalData;
  provinces: ProvinceData[];
  projection: { id: number; raw: number; projected: number; p5: number; p95: number }[] | null;
}
