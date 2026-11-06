/**
 * Adapters from normalised feed data to model inputs. Pure.
 */
import type { MunicData, NationalData, ProvinceData } from "../iec/types";
import { IND_ID, OTHER_ID } from "../iec/types";
import type { SeatModel } from "../config";
import type { ProjectionInput } from "./projection";
import type { CouncilSimInput } from "./coalitions";

/**
 * Projection input from the nine province files. Voting-district counts (counted/expected) come
 * from each province file itself, so they match the votes in that file; the national Lite file is
 * used only to pick the party set and to impute parties folded into a province's OTHER row.
 */
export function buildProjectionInput(nat: NationalData, provinces: ProvinceData[]): ProjectionInput {
  return {
    partyIds: nat.parties.filter((p) => p.id !== OTHER_ID).map((p) => p.id),
    nationalVotes: Object.fromEntries(nat.parties.map((p) => [p.id, p.votes])),
    provinces: provinces.map((p) => ({
      id: p.id,
      name: p.name,
      counted: p.progress.vdsComplete,
      expected: p.progress.vdsExpected,
      registered: p.totals.registered || nat.provinces.find((q) => q.id === p.id)?.totals.registered || 0,
      valid: p.totals.valid,
      votes: Object.fromEntries(p.parties.map((x) => [x.id, x.votes])),
    })),
  };
}

export function buildCouncilSimInput(m: MunicData, model: SeatModel): CouncilSimInput {
  const ind = m.parties.find((p) => p.id === IND_ID);
  return {
    parties: m.parties
      .filter((p) => p.id !== IND_ID)
      .map((p) => ({ id: p.id, votes: model === "mmp" ? p.votes : p.prVotes, wardSeats: p.wardSeats })),
    totalSeats: m.totalSeats,
    vdsComplete: m.progress.vdsComplete,
    vdsExpected: m.progress.vdsExpected,
    independentWardSeats: ind?.wardSeats ?? 0,
    model,
  };
}
