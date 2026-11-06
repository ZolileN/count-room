/**
 * Coalition arithmetic. This is seat counting, not a prediction of who will govern: it says which
 * combinations of parties hold enough seats between them, nothing about whether they would agree.
 */
import { gaussian, hashSeed, mulberry32, percentile } from "./rng";
import { allocateMixedMember, allocateSeats, majorityLine } from "./seats";
import { perturbShares, uncountedFraction } from "./projection";
import type { SeatModel } from "../config";

export { majorityLine };

export interface SeatHolder {
  id: number;
  seats: number;
}

export interface Coalition {
  members: number[];
  seats: number;
  /** Share of seat simulations in which these members together reach the majority line, 0–1. */
  probability: number;
}

export interface CoalitionOptions {
  /** Consider only the largest N parties by seats. */
  topN?: number;
  maxSize?: number;
  /** Party IDs never treated as a bloc (independents are individual councillors). */
  exclude?: number[];
}

export const DEFAULT_TOP_N = 10;
export const DEFAULT_MAX_SIZE = 4;

/** Every k-subset of `items`, in lexicographic order of indices. */
export function* combinations<T>(items: T[], k: number): Generator<T[]> {
  const n = items.length;
  if (k > n || k <= 0) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => items[i]!);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]!++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

/**
 * Minimal winning coalitions: sets of up to `maxSize` parties (from the top `topN` by seats) whose
 * seats reach floor(total/2)+1, and where dropping any one member falls below that line.
 * Sorted by size, then by seats (callers re-sort by probability once simulated).
 */
export function minimalWinningCoalitions(
  holders: SeatHolder[],
  totalSeats: number,
  opts: CoalitionOptions = {},
): Omit<Coalition, "probability">[] {
  const topN = opts.topN ?? DEFAULT_TOP_N;
  const maxSize = opts.maxSize ?? DEFAULT_MAX_SIZE;
  const exclude = new Set(opts.exclude ?? []);
  const need = majorityLine(totalSeats);
  const pool = holders
    .filter((h) => h.seats > 0 && !exclude.has(h.id))
    .sort((a, b) => b.seats - a.seats || a.id - b.id)
    .slice(0, topN);

  const out: Omit<Coalition, "probability">[] = [];
  for (let k = 1; k <= Math.min(maxSize, pool.length); k++) {
    for (const combo of combinations(pool, k)) {
      const seats = combo.reduce((a, h) => a + h.seats, 0);
      if (seats < need) continue;
      if (combo.some((h) => seats - h.seats >= need)) continue; // not minimal
      out.push({ members: combo.map((h) => h.id), seats });
    }
  }
  return out.sort((a, b) => a.members.length - b.members.length || b.seats - a.seats);
}

export function isWinning(members: number[], seatsById: Map<number, number>, totalSeats: number): boolean {
  const s = members.reduce((a, id) => a + (seatsById.get(id) ?? 0), 0);
  return s >= majorityLine(totalSeats);
}

export interface CouncilSimParty {
  id: number;
  /** Votes the seat model allocates on (PR votes for Droop, ward + PR for the mixed-member model). */
  votes: number;
  wardSeats: number;
}

export interface CouncilSimInput {
  parties: CouncilSimParty[];
  totalSeats: number;
  vdsComplete: number;
  vdsExpected: number;
  independentWardSeats?: number;
  model: SeatModel;
}

export interface CouncilSimResult {
  /** Seat point estimate from the counted votes, by party ID. */
  seats: Map<number, number>;
  /** 5th/50th/95th percentile seats by party ID. */
  ranges: Map<number, { p5: number; p50: number; p95: number }>;
  /** Each simulation's seat vector, aligned with `ids`. */
  draws: Int32Array[];
  ids: number[];
  sims: number;
  seed: number;
}

export const DEFAULT_COUNCIL_SIMS = 2000;

function allocate(model: SeatModel, ids: number[], votes: ArrayLike<number>, input: CouncilSimInput): number[] {
  if (model === "mmp") {
    const res = allocateMixedMember({
      parties: ids.map((id, i) => ({ id, votes: votes[i]!, wardSeats: input.parties[i]!.wardSeats })),
      seats: input.totalSeats,
      independentWardSeats: input.independentWardSeats ?? 0,
    });
    return res.map((r) => r.seats);
  }
  const res = allocateSeats(ids.map((id, i) => ({ id, votes: votes[i]! })), input.totalSeats - (input.independentWardSeats ?? 0));
  return res.map((r) => r.seats);
}

/**
 * Simulate a council's seats under the same noise model as the national projection, applied at
 * council level: shares perturbed by N(0, (1.2 + 0.14·s)·√u) points with u the share of voting
 * districts not yet reported, then seats re-allocated.
 */
export function simulateCouncil(input: CouncilSimInput, sims = DEFAULT_COUNCIL_SIMS, seed?: number): CouncilSimResult {
  const ids = input.parties.map((p) => p.id);
  const total = input.parties.reduce((a, p) => a + p.votes, 0);
  const base = Float64Array.from(input.parties.map((p) => (total > 0 ? (p.votes / total) * 100 : 0)));
  const u = uncountedFraction(input.vdsComplete, input.vdsExpected);
  const s0 = seed ?? hashSeed(`${input.model}|${input.totalSeats}|${input.vdsComplete}|${input.parties.map((p) => `${p.id}:${p.votes}:${p.wardSeats}`).join(",")}`);

  const point = allocate(input.model, ids, base, input);
  const z = gaussian(mulberry32(s0));
  const buf = new Float64Array(ids.length);
  const n = u > 0 ? sims : 1;
  const draws: Int32Array[] = [];
  for (let s = 0; s < n; s++) {
    const shares = u > 0 ? perturbShares(base, u, z, buf) : base;
    draws.push(Int32Array.from(allocate(input.model, ids, shares, input)));
  }

  const ranges = new Map<number, { p5: number; p50: number; p95: number }>();
  ids.forEach((id, i) => {
    const col = Float64Array.from(draws, (d) => d[i]!).sort();
    ranges.set(id, { p5: Math.round(percentile(col, 5)), p50: Math.round(percentile(col, 50)), p95: Math.round(percentile(col, 95)) });
  });

  return { seats: new Map(ids.map((id, i) => [id, point[i]!])), ranges, draws, ids, sims: n, seed: s0 };
}

/** Share of simulations in which each coalition reaches the majority line. */
export function coalitionProbabilities(
  coalitions: Omit<Coalition, "probability">[],
  sim: Pick<CouncilSimResult, "draws" | "ids">,
  totalSeats: number,
): Coalition[] {
  const need = majorityLine(totalSeats);
  const index = new Map(sim.ids.map((id, i) => [id, i]));
  return coalitions
    .map((c) => {
      const cols = c.members.map((id) => index.get(id)).filter((i): i is number => i !== undefined);
      let wins = 0;
      for (const d of sim.draws) {
        let s = 0;
        for (const i of cols) s += d[i]!;
        if (s >= need) wins++;
      }
      return { ...c, probability: sim.draws.length > 0 ? wins / sim.draws.length : 0 };
    })
    .sort((a, b) => a.members.length - b.members.length || b.probability - a.probability || b.seats - a.seats);
}
