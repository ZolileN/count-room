/** Compact per-council map data: just what the client needs to colour the map. */
import type { CouncilStatus, CouncilSummary } from "./iec/types";

export interface MapCouncil {
  id: number;
  name: string;
  provinceId: number;
  status: CouncilStatus;
  declared: boolean;
  leader: { id: number; short: string } | null;
  leaderSeats: number;
  totalSeats: number;
  vdsPct: number;
}

export function toMapCouncils(councils: CouncilSummary[]): MapCouncil[] {
  return councils.map((c) => ({
    id: c.id,
    name: c.name,
    provinceId: c.provinceId,
    status: c.status,
    declared: c.declared,
    leader: c.leader ? { id: c.leader.id, short: c.leader.short } : null,
    leaderSeats: c.leaderSeats,
    totalSeats: c.totalSeats,
    vdsPct: (c.progress.vdsComplete / Math.max(1, c.progress.vdsExpected)) * 100,
  }));
}
