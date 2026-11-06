/**
 * Everything the council page needs, computed once on the server: seats (real or modelled), seat
 * ranges, and minimal winning coalitions with their simulated probability.
 */
import type { MunicData } from "../iec/types";
import { IND_ID } from "../iec/types";
import type { SeatModel } from "../config";
import { buildCouncilSimInput } from "./inputs";
import {
  coalitionProbabilities,
  minimalWinningCoalitions,
  simulateCouncil,
  type Coalition,
} from "./coalitions";
import { majorityLine } from "./seats";

export interface CouncilSeatRow {
  id: number;
  short: string;
  name: string;
  votes: number;
  pct: number;
  prVotes: number;
  wardSeats: number;
  seats: number;
  /** 90% range; equal to `seats` when declared. */
  low: number;
  high: number;
}

export interface CouncilAnalysis {
  /** "declared": IEC seats. "model": our estimate while counting. */
  seatsSource: "declared" | "model";
  model: SeatModel;
  totalSeats: number;
  majority: number;
  rows: CouncilSeatRow[];
  coalitions: Coalition[];
  sims: number;
}

export function analyseCouncil(m: MunicData, model: SeatModel): CouncilAnalysis {
  const totalSeats = m.totalSeats;
  const majority = majorityLine(totalSeats);
  const indSeats = m.parties.find((p) => p.id === IND_ID)?.seats ?? 0;

  if (m.declared) {
    const rows = m.parties
      .filter((p) => p.seats > 0)
      .map((p) => ({ id: p.id, short: p.short, name: p.name, votes: p.votes, pct: p.pct, prVotes: p.prVotes, wardSeats: p.wardSeats, seats: p.seats, low: p.seats, high: p.seats }))
      .sort((a, b) => b.seats - a.seats || b.votes - a.votes);
    const mwc = minimalWinningCoalitions(rows, totalSeats, { exclude: [IND_ID] });
    return {
      seatsSource: "declared",
      model,
      totalSeats,
      majority,
      rows,
      coalitions: mwc.map((c) => ({ ...c, probability: 1 })),
      sims: 0,
    };
  }

  const sim = simulateCouncil(buildCouncilSimInput(m, model));
  const byId = new Map(m.parties.map((p) => [p.id, p]));
  const rows: CouncilSeatRow[] = sim.ids
    .map((id) => {
      const p = byId.get(id)!;
      const r = sim.ranges.get(id)!;
      return { id, short: p.short, name: p.name, votes: p.votes, pct: p.pct, prVotes: p.prVotes, wardSeats: p.wardSeats, seats: sim.seats.get(id) ?? 0, low: r.p5, high: r.p95 };
    })
    .filter((r) => r.seats > 0 || r.high > 0);
  if (indSeats > 0) {
    const ind = byId.get(IND_ID)!;
    rows.push({ id: IND_ID, short: ind.short, name: ind.name, votes: ind.votes, pct: ind.pct, prVotes: 0, wardSeats: ind.wardSeats, seats: indSeats, low: indSeats, high: indSeats });
  }
  rows.sort((a, b) => b.seats - a.seats || b.votes - a.votes);

  const mwc = minimalWinningCoalitions(rows, totalSeats, { exclude: [IND_ID] });
  return {
    seatsSource: "model",
    model,
    totalSeats,
    majority,
    rows,
    coalitions: coalitionProbabilities(mwc, sim, totalSeats),
    sims: sim.sims,
  };
}
