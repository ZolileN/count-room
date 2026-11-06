import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseNational, normaliseProvince } from "../iec/normalise";
import { gaussian, mulberry32 } from "./rng";
import {
  OTHER_PARTY,
  perturbShares,
  projectNational,
  reconcile,
  uncountedFraction,
  type ProjectionInput,
  type ProvinceInput,
} from "./projection";
import { buildProjectionInput } from "./inputs";

const prov = (id: number, counted: number, expected: number, votes: Record<number, number>, registered = 1_000_000): ProvinceInput => ({
  id,
  name: `P${id}`,
  counted,
  expected,
  registered,
  valid: Object.values(votes).reduce((a, v) => a + v, 0),
  votes,
});

describe("perturbShares", () => {
  it("returns shares summing to 100 with no negatives", () => {
    const z = gaussian(mulberry32(3));
    const base = [45.2, 30.1, 10.3, 8.4, 4.0, 1.5, 0.4, 0.1];
    const out = new Float64Array(base.length);
    for (let i = 0; i < 2000; i++) {
      perturbShares(base, 0.6, z, out);
      const sum = out.reduce((a, v) => a + v, 0);
      expect(sum).toBeCloseTo(100, 9);
      for (const v of out) expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("is a no-op when everything is counted", () => {
    const z = gaussian(mulberry32(3));
    const base = [60, 40];
    const out = perturbShares(base, 0, z, new Float64Array(2));
    expect([...out]).toEqual([60, 40]);
  });
});

describe("projectNational", () => {
  // Province 1 is fully counted and 70/30 for party A; province 2 is a quarter counted, 30/70.
  const input: ProjectionInput = {
    provinces: [prov(1, 100, 100, { 1: 70_000, 2: 30_000 }), prov(2, 25, 100, { 1: 7_500, 2: 17_500 })],
  };
  const res = projectNational(input, { sims: 3000 });

  it("re-weights provinces to their projected size", () => {
    const a = res.parties.find((p) => p.id === 1)!;
    // Raw: 77.5k / 125k = 62%. Projected: (70k + 0.3 * 100k) / 200k = 50%.
    expect(a.raw).toBeCloseTo(62, 6);
    expect(a.projected).toBeCloseTo(50, 6);
    expect(a.shift).toBeCloseTo(-12, 6);
    expect(res.projectedValid).toBeCloseTo(200_000, 6);
  });

  it("brackets the point estimate in its 90% range", () => {
    for (const p of res.parties) {
      expect(p.p5).toBeLessThanOrEqual(p.p50);
      expect(p.p50).toBeLessThanOrEqual(p.p95);
      if (p.projected > 1) {
        expect(p.p5).toBeLessThanOrEqual(p.projected);
        expect(p.p95).toBeGreaterThanOrEqual(p.projected);
      }
    }
  });

  it("projected shares sum to 100", () => {
    expect(res.parties.reduce((a, p) => a + p.projected, 0)).toBeCloseTo(100, 6);
  });

  it("is stable for the same data and changes with it", () => {
    const again = projectNational(input, { sims: 3000 });
    expect(again.parties).toEqual(res.parties);
    const changed = projectNational({ provinces: [input.provinces[0]!, prov(2, 26, 100, { 1: 7_600, 2: 17_500 })] });
    expect(changed.seed).not.toBe(res.seed);
  });

  it("has zero width when every province is complete", () => {
    const done = projectNational({ provinces: [prov(1, 10, 10, { 1: 600, 2: 400 }), prov(2, 5, 5, { 1: 100, 2: 300 })] });
    for (const p of done.parties) {
      expect(p.p95 - p.p5).toBeCloseTo(0, 9);
      expect(p.projected).toBeCloseTo(p.raw, 9);
    }
  });

  it("fills a province that has reported nothing from the national mix", () => {
    const r = projectNational({
      provinces: [prov(1, 50, 100, { 1: 60_000, 2: 40_000 }, 400_000), prov(2, 0, 100, {}, 400_000)],
    });
    const p2 = r.provinces.find((p) => p.id === 2)!;
    expect(p2.noData).toBe(true);
    expect(p2.projectedValid).toBeCloseTo(200_000, 6);
    expect(r.parties.find((p) => p.id === 1)!.projected).toBeCloseTo(60, 6);
  });
});

describe("reconcile", () => {
  it("imputes a party the province folded into OTHER, from the national residual", () => {
    const { provinces, imputed } = reconcile({
      provinces: [prov(1, 1, 1, { 1: 500, [OTHER_PARTY]: 100 }), prov(2, 1, 1, { 1: 300, 3: 50, [OTHER_PARTY]: 50 })],
      partyIds: [1, 3],
      nationalVotes: { 1: 800, 3: 90, [OTHER_PARTY]: 110 },
    });
    // Party 3 is missing from province 1; national residual is 90 − 50 = 40.
    expect(imputed).toEqual([{ partyId: 3, provinceId: 1, votes: 40 }]);
    expect(provinces[0]!.votes[3]).toBe(40);
    expect(provinces[0]!.votes[OTHER_PARTY]).toBe(60);
    // Province totals are unchanged.
    for (const p of provinces) expect(Object.values(p.votes).reduce((a, v) => a + v, 0)).toBe(p.valid);
  });

  it("folds parties outside the projected set into OTHER", () => {
    const { provinces } = reconcile({ provinces: [prov(1, 1, 1, { 1: 10, 9: 5, [OTHER_PARTY]: 1 })], partyIds: [1] });
    expect(provinces[0]!.votes).toEqual({ 1: 10, [OTHER_PARTY]: 6 });
  });
});

describe("uncountedFraction", () => {
  it("clamps to [0, 1]", () => {
    expect(uncountedFraction(50, 100)).toBe(0.5);
    expect(uncountedFraction(120, 100)).toBe(0);
    expect(uncountedFraction(0, 0)).toBe(0);
  });
});

describe("with the 6 Nov fixtures", () => {
  const fx = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures", f), "utf8")) as unknown;
  const nat = normaliseNational(fx("2026/national.json"));
  const provinces = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => normaliseProvince(fx(`2026/province${i}.json`)));
  const res = projectNational(buildProjectionInput(nat, provinces));

  it("keeps province totals and sums to 100", () => {
    expect(res.parties.reduce((a, p) => a + p.projected, 0)).toBeCloseTo(100, 6);
    expect(res.provinces).toHaveLength(9);
    expect(res.rawValid).toBe(provinces.reduce((a, p) => a + p.totals.valid, 0));
  });

  it("produces finite, ordered ranges for every party", () => {
    for (const p of res.parties) {
      expect(Number.isFinite(p.p5) && Number.isFinite(p.p95)).toBe(true);
      expect(p.p5).toBeLessThanOrEqual(p.p95);
    }
  });
});
