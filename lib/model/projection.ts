/**
 * Province-stratified national projection with Monte Carlo uncertainty.
 *
 * Votes are counted unevenly: on the night, some provinces are nearly done while others have a
 * third of their voting districts still out. A raw national share therefore over-weights the
 * provinces that count fastest. We correct for that by projecting each province's valid-vote total
 * to 100% of voting districts, holding its current party shares, then re-weighting.
 *
 * Pure functions only: no I/O, deterministic for a given input (seeded PRNG).
 */
import { gaussian, hashSeed, mulberry32, percentile } from "./rng";

export const OTHER_PARTY = -2;

export interface ProvinceInput {
  id: number;
  name: string;
  /** Voting districts reported. */
  counted: number;
  /** Voting districts expected. */
  expected: number;
  /** Registered voters (used only when a province has reported nothing yet). */
  registered: number;
  /** Valid votes counted so far (both ballots). */
  valid: number;
  /** Votes by party ID, including OTHER (-2). Should sum to `valid`. */
  votes: Record<number, number>;
}

export interface ProjectionInput {
  provinces: ProvinceInput[];
  /**
   * Party IDs to project (normally the national top parties). Parties outside this set are
   * folded into OTHER. Defaults to every party seen in any province.
   */
  partyIds?: number[];
  /**
   * National totals by party, used only to estimate votes for a party the IEC folded into OTHER in
   * some provinces (each province file lists only its own top 13). Optional.
   */
  nationalVotes?: Record<number, number>;
}

export interface ProjectionOptions {
  sims?: number;
  seed?: number;
}

export interface PartyProjection {
  id: number;
  /** Share of valid votes counted so far, percentage points. */
  raw: number;
  /** Point estimate after re-weighting provinces to full count. */
  projected: number;
  /** projected − raw */
  shift: number;
  p5: number;
  p50: number;
  p95: number;
}

export interface ProvinceProjection {
  id: number;
  name: string;
  counted: number;
  expected: number;
  /** Share of voting districts still to report, 0–1. */
  uncounted: number;
  valid: number;
  projectedValid: number;
  /** Share of national valid votes counted so far, 0–100. */
  weightRaw: number;
  /** Share of projected national valid votes, 0–100. */
  weightProjected: number;
  /** True when nothing has been reported yet and the province is filled from the national mix. */
  noData: boolean;
}

export interface Imputation {
  partyId: number;
  provinceId: number;
  votes: number;
}

export interface ProjectionResult {
  parties: PartyProjection[];
  provinces: ProvinceProjection[];
  rawValid: number;
  projectedValid: number;
  /** Votes we moved out of a province's OTHER row into a named party (see reconcile). */
  imputed: Imputation[];
  sims: number;
  seed: number;
}

export const DEFAULT_SIMS = 3000;

/** Standard deviation (percentage points) of a share perturbation, per the model spec. */
export function shareSd(sharePct: number, uncounted: number): number {
  return (1.2 + 0.14 * sharePct) * Math.sqrt(Math.max(0, uncounted));
}

/** Standard deviation of the multiplicative turnout perturbation. */
export function turnoutSd(uncounted: number): number {
  return 0.06 * Math.sqrt(Math.max(0, uncounted));
}

export function uncountedFraction(counted: number, expected: number): number {
  if (expected <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - counted / expected));
}

/**
 * Restrict each province to the projected party set plus OTHER and, where a projected party is
 * missing from a province (folded into that province's OTHER by the IEC), estimate its votes there
 * from the national total, taking them out of that province's OTHER.
 *
 * The residual for party k is national_k − Σ(listed provinces), scaled to the province files'
 * total (the national file and the province files are published a few minutes apart). It is shared
 * among the provinces where k is missing in proportion to their OTHER votes, and never takes more
 * than a province's OTHER row holds.
 */
export function reconcile(input: ProjectionInput): { provinces: ProvinceInput[]; partyIds: number[]; imputed: Imputation[] } {
  const seen = new Set<number>();
  for (const p of input.provinces) for (const id of Object.keys(p.votes)) seen.add(Number(id));
  const partyIds = (input.partyIds ?? [...seen]).filter((id) => id !== OTHER_PARTY);
  const keep = new Set(partyIds);

  const provinces = input.provinces.map((p) => {
    const votes: Record<number, number> = {};
    let other = 0;
    for (const [k, v] of Object.entries(p.votes)) {
      const id = Number(k);
      if (keep.has(id)) votes[id] = v;
      else other += v;
    }
    votes[OTHER_PARTY] = other;
    return { ...p, votes };
  });

  const imputed: Imputation[] = [];
  const nat = input.nationalVotes;
  if (nat) {
    const provValid = provinces.reduce((a, p) => a + p.valid, 0);
    const natValid = Object.values(nat).reduce((a, v) => a + v, 0);
    const scale = natValid > 0 ? provValid / natValid : 1;
    // First pass: what each missing party would like to take from each province's OTHER.
    const wants: { id: number; prov: number; v: number }[] = [];
    for (const id of partyIds) {
      if (nat[id] === undefined) continue;
      const missing = provinces.filter((p) => p.votes[id] === undefined);
      if (missing.length === 0) continue;
      const listed = provinces.reduce((a, p) => a + (p.votes[id] ?? 0), 0);
      const residual = Math.max(0, nat[id] * scale - listed);
      const pool = missing.reduce((a, p) => a + (p.votes[OTHER_PARTY] ?? 0), 0);
      for (const p of missing) {
        const v = pool > 0 ? (residual * (p.votes[OTHER_PARTY] ?? 0)) / pool : 0;
        wants.push({ id, prov: p.id, v });
      }
    }
    // Second pass: scale down where requests exceed a province's OTHER row.
    for (const p of provinces) {
      const mine = wants.filter((w) => w.prov === p.id);
      const total = mine.reduce((a, w) => a + w.v, 0);
      const avail = p.votes[OTHER_PARTY] ?? 0;
      const f = total > avail && total > 0 ? avail / total : 1;
      for (const w of mine) {
        const v = Math.round(w.v * f);
        p.votes[w.id] = v;
        p.votes[OTHER_PARTY] = (p.votes[OTHER_PARTY] ?? 0) - v;
        if (v > 0) imputed.push({ partyId: w.id, provinceId: p.id, votes: v });
      }
    }
  }
  for (const p of provinces) for (const id of partyIds) p.votes[id] ??= 0;
  return { provinces, partyIds: [...partyIds, OTHER_PARTY], imputed };
}

/** Deterministic seed from the inputs, so identical data gives identical ranges. */
export function seedFor(input: ProjectionInput): number {
  const parts = input.provinces
    .map((p) => `${p.id}:${p.counted}/${p.expected}:${p.valid}:${Object.entries(p.votes).sort().map(([k, v]) => `${k}=${v}`).join(",")}`)
    .join("|");
  return hashSeed(parts);
}

/**
 * Renormalise a share vector (in place) to sum to 100 after clipping negatives to zero.
 * Returns false if everything clipped to zero (caller keeps the unperturbed shares).
 */
export function clipAndRenormalise(shares: Float64Array): boolean {
  let sum = 0;
  for (let i = 0; i < shares.length; i++) {
    if (shares[i]! < 0) shares[i] = 0;
    sum += shares[i]!;
  }
  if (sum <= 0) return false;
  for (let i = 0; i < shares.length; i++) shares[i] = (shares[i]! * 100) / sum;
  return true;
}

/**
 * Perturb one share vector per the model spec: each share s gets N(0, (1.2 + 0.14·s)·√u)
 * percentage points, then clip at 0 and renormalise to 100. Shares that are exactly zero (a
 * party with no votes in that area) are left at zero rather than conjured from noise.
 */
export function perturbShares(base: ArrayLike<number>, uncounted: number, z: () => number, out: Float64Array): Float64Array {
  for (let i = 0; i < base.length; i++) {
    const s = base[i]!;
    out[i] = s > 0 ? s + z() * shareSd(s, uncounted) : 0;
  }
  if (!clipAndRenormalise(out)) for (let i = 0; i < base.length; i++) out[i] = base[i]!;
  return out;
}

export function projectNational(input: ProjectionInput, opts: ProjectionOptions = {}): ProjectionResult {
  const sims = opts.sims ?? DEFAULT_SIMS;
  const seed = opts.seed ?? seedFor(input);
  const { provinces, partyIds, imputed } = reconcile(input);
  const K = partyIds.length;

  const rawValid = provinces.reduce((a, p) => a + p.valid, 0);
  const rawVotes = partyIds.map((id) => provinces.reduce((a, p) => a + (p.votes[id] ?? 0), 0));
  const nationalRawShares = rawVotes.map((v) => (rawValid > 0 ? (v / rawValid) * 100 : 0));

  // Per-province shares, uncounted fraction and projected valid votes.
  const reported = provinces.filter((p) => p.counted > 0 && p.valid > 0);
  const projReported = reported.reduce((a, p) => a + (p.valid * p.expected) / p.counted, 0);
  const regReported = reported.reduce((a, p) => a + p.registered, 0);
  const validPerRegistered = regReported > 0 ? projReported / regReported : 0;

  const prov = provinces.map((p) => {
    const noData = !(p.counted > 0 && p.valid > 0);
    const u = noData ? 1 : uncountedFraction(p.counted, p.expected);
    const V = noData ? p.registered * validPerRegistered : (p.valid * Math.max(p.expected, p.counted)) / p.counted;
    const shares = noData
      ? Float64Array.from(nationalRawShares)
      : Float64Array.from(partyIds.map((id) => ((p.votes[id] ?? 0) / p.valid) * 100));
    return { p, u, V, shares, noData };
  });

  const projectedValid = prov.reduce((a, x) => a + x.V, 0);
  const point = partyIds.map((_, k) =>
    projectedValid > 0 ? prov.reduce((a, x) => a + x.shares[k]! * x.V, 0) / projectedValid : 0,
  );

  // Monte Carlo.
  const z = gaussian(mulberry32(seed));
  const draws = partyIds.map(() => new Float64Array(sims));
  const buf = new Float64Array(K);
  const acc = new Float64Array(K);
  for (let s = 0; s < sims; s++) {
    acc.fill(0);
    let totalV = 0;
    for (const x of prov) {
      perturbShares(x.shares, x.u, z, buf);
      const V = Math.max(0, x.V * (1 + z() * turnoutSd(x.u)));
      totalV += V;
      for (let k = 0; k < K; k++) acc[k]! += buf[k]! * V;
    }
    for (let k = 0; k < K; k++) draws[k]![s] = totalV > 0 ? acc[k]! / totalV : 0;
  }

  const parties: PartyProjection[] = partyIds.map((id, k) => {
    const sorted = draws[k]!.sort();
    const raw = nationalRawShares[k]!;
    const projected = point[k]!;
    return {
      id,
      raw,
      projected,
      shift: projected - raw,
      p5: percentile(sorted, 5),
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
    };
  });
  parties.sort((a, b) => (a.id === OTHER_PARTY ? 1 : b.id === OTHER_PARTY ? -1 : b.projected - a.projected));

  return {
    parties,
    provinces: prov.map((x) => ({
      id: x.p.id,
      name: x.p.name,
      counted: x.p.counted,
      expected: x.p.expected,
      uncounted: x.u,
      valid: x.p.valid,
      projectedValid: x.V,
      weightRaw: rawValid > 0 ? (x.p.valid / rawValid) * 100 : 0,
      weightProjected: projectedValid > 0 ? (x.V / projectedValid) * 100 : 0,
      noData: x.noData,
    })),
    rawValid,
    projectedValid,
    imputed,
    sims,
    seed,
  };
}
