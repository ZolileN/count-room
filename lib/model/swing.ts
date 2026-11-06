/**
 * Swing against the previous election, and "votes needed" in close wards. Pure functions.
 *
 * Ward boundaries were redrawn for 2026, so comparing a 2026 ward with the 2021 ward that had the
 * same number would often compare different areas. Instead we compare by voting district (VD):
 * for each 2026 ward we take the VDs that have reported in 2026 and also existed in 2021, and
 * compare party shares across exactly that set, in both years. That is like-for-like even while
 * counting is incomplete, and it re-draws 2021 on 2026 boundaries.
 *
 * Shares are of valid votes on the ward and PR ballots combined (the only party breakdown the IEC
 * publishes per VD), in percentage points.
 */
import type { MunicData, PreviousCouncil, VotePairs, Ward } from "../iec/types";

export interface Shares {
  [partyId: number]: number;
}

export interface WardComparison {
  wardId: number;
  number: number;
  /** VDs counted in 2026 that also existed in 2021. */
  matchedVds: number;
  /** VDs counted in 2026. */
  reportedVds: number;
  /** Share of this ward's counted 2026 votes that fall in matched VDs, 0–1. */
  coverage: number;
  validNow: number;
  validThen: number;
  now: Shares;
  then: Shares;
  /** now − then, percentage points, for every party present in either year. */
  swing: Shares;
}

export interface CouncilSwing {
  wards: WardComparison[];
  /** All matched VDs in the council together. */
  overall: Omit<WardComparison, "wardId" | "number">;
}

function addPairs(acc: Map<number, number>, pairs: VotePairs): number {
  let t = 0;
  for (const [id, v] of pairs) {
    acc.set(id, (acc.get(id) ?? 0) + v);
    t += v;
  }
  return t;
}

function toShares(m: Map<number, number>, total: number): Shares {
  const out: Shares = {};
  for (const [id, v] of m) out[id] = total > 0 ? (v / total) * 100 : 0;
  return out;
}

function compareVds(vds: Ward["vds"], prev: PreviousCouncil) {
  const nowVotes = new Map<number, number>();
  const thenVotes = new Map<number, number>();
  let validNow = 0;
  let validThen = 0;
  let reported = 0;
  let matched = 0;
  let reportedVotes = 0;
  for (const vd of vds) {
    if (vd.valid <= 0) continue;
    reported++;
    reportedVotes += vd.valid;
    const old = prev.vds[vd.id];
    if (!old || old.length === 0) continue;
    matched++;
    validNow += addPairs(nowVotes, vd.votes);
    validThen += addPairs(thenVotes, old);
  }
  const now = toShares(nowVotes, validNow);
  const then = toShares(thenVotes, validThen);
  const swing: Shares = {};
  for (const id of new Set([...nowVotes.keys(), ...thenVotes.keys()])) swing[id] = (now[id] ?? 0) - (then[id] ?? 0);
  return {
    matchedVds: matched,
    reportedVds: reported,
    coverage: reportedVotes > 0 ? validNow / reportedVotes : 0,
    validNow,
    validThen,
    now,
    then,
    swing,
  };
}

export function compareWard(ward: Ward, prev: PreviousCouncil): WardComparison {
  return { wardId: ward.id, number: ward.number, ...compareVds(ward.vds, prev) };
}

export function councilSwing(m: Pick<MunicData, "wards">, prev: PreviousCouncil): CouncilSwing {
  return {
    wards: m.wards.map((w) => compareWard(w, prev)),
    overall: compareVds(m.wards.flatMap((w) => w.vds), prev),
  };
}

export interface SwingEntry {
  wardId: number;
  number: number;
  partyId: number;
  swing: number;
  now: number;
  then: number;
  coverage: number;
}

/**
 * Largest absolute swings for the given parties across wards. Wards where less than `minCoverage`
 * of the counted vote can be matched to 2021 are left out, as are wards with very few matched votes.
 */
export function biggestSwings(
  comparisons: WardComparison[],
  partyIds: number[],
  opts: { n?: number; minCoverage?: number; minVotes?: number } = {},
): SwingEntry[] {
  const minCoverage = opts.minCoverage ?? 0.6;
  const minVotes = opts.minVotes ?? 200;
  const out: SwingEntry[] = [];
  for (const c of comparisons) {
    if (c.coverage < minCoverage || c.validNow < minVotes || c.validThen < minVotes) continue;
    for (const id of partyIds) {
      const s = c.swing[id];
      if (s === undefined) continue;
      out.push({ wardId: c.wardId, number: c.number, partyId: id, swing: s, now: c.now[id] ?? 0, then: c.then[id] ?? 0, coverage: c.coverage });
    }
  }
  return out.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing) || a.number - b.number).slice(0, opts.n ?? 20);
}

export interface VotesNeeded {
  leaderId: number;
  runnerUpId: number;
  leaderVotes: number;
  runnerUpVotes: number;
  /** Leader's lead in votes. */
  margin: number;
  /** Lead as a share of valid ward votes, percentage points. */
  marginPct: number;
  /** Extra votes the runner-up would have needed (with no change to the leader's): margin + 1. */
  additional: number;
  /** Voters who would have needed to switch from the leader to the runner-up: floor(margin / 2) + 1. */
  switchers: number;
}

/** "Votes needed" on the ward ballot. Null when fewer than two candidates have votes. */
export function votesNeeded(ward: Pick<Ward, "parties" | "valid">): VotesNeeded | null {
  const [a, b] = ward.parties;
  if (!a || !b) return null;
  const margin = a.votes - b.votes;
  return {
    leaderId: a.id,
    runnerUpId: b.id,
    leaderVotes: a.votes,
    runnerUpVotes: b.votes,
    margin,
    marginPct: ward.valid > 0 ? (margin / ward.valid) * 100 : 0,
    additional: margin + 1,
    switchers: Math.floor(margin / 2) + 1,
  };
}

/** Wards decided (or led) by less than `thresholdPct` points, closest first. */
export function closeWards<W extends Pick<Ward, "id" | "number" | "parties" | "valid" | "declared">>(
  wards: W[],
  thresholdPct = 5,
): (VotesNeeded & { ward: W })[] {
  return wards
    .map((w) => {
      const v = votesNeeded(w);
      return v ? { ...v, ward: w } : null;
    })
    .filter((x): x is VotesNeeded & { ward: W } => !!x && x.marginPct < thresholdPct)
    .sort((a, b) => a.marginPct - b.marginPct || a.margin - b.margin);
}
