import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseMunic, normalisePrevious } from "../iec/normalise";
import type { PreviousCouncil, Ward } from "../iec/types";
import { biggestSwings, closeWards, compareWard, councilSwing, votesNeeded } from "./swing";

const fx = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures", f), "utf8")) as unknown;

const ward = (over: Partial<Ward>): Ward => ({
  id: 1001,
  number: 1,
  reportDate: "",
  declared: false,
  valid: 0,
  vdsReported: 0,
  vdsTotal: 0,
  parties: [],
  combined: [],
  vds: [],
  ...over,
});

const prev = (vds: PreviousCouncil["vds"]): PreviousCouncil => ({ id: 1, year: 2021, reportDate: "", totalSeats: 10, parties: [], vds, vdWard: {} });

describe("compareWard", () => {
  it("compares only VDs counted now that existed then", () => {
    const w = ward({
      vds: [
        { id: 1, valid: 100, votes: [[7, 60], [52, 40]] },
        { id: 2, valid: 100, votes: [[7, 20], [52, 80]] }, // new VD: no 2021 record
        { id: 3, valid: 0, votes: [] }, // not yet counted
      ],
    });
    const c = compareWard(w, prev({ 1: [[7, 50], [52, 50]], 3: [[7, 100]] }));
    expect(c.reportedVds).toBe(2);
    expect(c.matchedVds).toBe(1);
    expect(c.coverage).toBeCloseTo(0.5, 9);
    expect(c.now[7]).toBeCloseTo(60, 9);
    expect(c.then[7]).toBeCloseTo(50, 9);
    expect(c.swing[7]).toBeCloseTo(10, 9);
    expect(c.swing[52]).toBeCloseTo(-10, 9);
  });

  it("treats a party absent in one year as zero there", () => {
    const c = compareWard(ward({ vds: [{ id: 1, valid: 10, votes: [[1748, 10]] }] }), prev({ 1: [[7, 10]] }));
    expect(c.swing[1748]).toBeCloseTo(100, 9);
    expect(c.swing[7]).toBeCloseTo(-100, 9);
  });

  it("swings across all parties sum to zero", () => {
    const m = normaliseMunic(fx("2026/munic1001.json"));
    const p = normalisePrevious(fx("2021/munic1001.json"), 2021);
    const s = councilSwing(m, p);
    for (const c of [...s.wards, { ...s.overall }]) {
      if (c.validNow === 0) continue;
      expect(Object.values(c.swing).reduce((a, v) => a + v, 0)).toBeCloseTo(0, 6);
    }
    expect(s.overall.matchedVds).toBeGreaterThan(150);
    expect(s.overall.coverage).toBeGreaterThan(0.8);
  });
});

describe("biggestSwings", () => {
  it("ranks by absolute swing and skips poorly matched wards", () => {
    const cs = [
      { wardId: 1, number: 1, matchedVds: 3, reportedVds: 3, coverage: 1, validNow: 1000, validThen: 1000, now: {}, then: {}, swing: { 7: -12 } },
      { wardId: 2, number: 2, matchedVds: 3, reportedVds: 3, coverage: 1, validNow: 1000, validThen: 1000, now: {}, then: {}, swing: { 7: 5 } },
      { wardId: 3, number: 3, matchedVds: 1, reportedVds: 3, coverage: 0.3, validNow: 1000, validThen: 1000, now: {}, then: {}, swing: { 7: 40 } },
    ];
    expect(biggestSwings(cs, [7]).map((e) => e.number)).toEqual([1, 2]);
  });
});

describe("votesNeeded", () => {
  it("computes extra votes and switchers", () => {
    const v = votesNeeded({ valid: 1000, parties: [{ id: 7, short: "ANC", votes: 520 }, { id: 52, short: "DA", votes: 480 }] })!;
    expect(v.margin).toBe(40);
    expect(v.marginPct).toBeCloseTo(4, 9);
    expect(v.additional).toBe(41);
    expect(v.switchers).toBe(21);
    // 21 switchers: 499 vs 501, runner-up wins. 20 would tie.
    expect(480 + v.switchers > 520 - v.switchers).toBe(true);
    expect(480 + (v.switchers - 1) > 520 - (v.switchers - 1)).toBe(false);
  });

  it("needs two candidates", () => {
    expect(votesNeeded({ valid: 10, parties: [{ id: 7, short: "ANC", votes: 10 }] })).toBeNull();
  });

  it("lists close wards, closest first", () => {
    const ws = [
      ward({ id: 1, number: 1, valid: 100, parties: [{ id: 1, short: "A", votes: 52 }, { id: 2, short: "B", votes: 48 }] }),
      ward({ id: 2, number: 2, valid: 100, parties: [{ id: 1, short: "A", votes: 70 }, { id: 2, short: "B", votes: 30 }] }),
      ward({ id: 3, number: 3, valid: 100, parties: [{ id: 1, short: "A", votes: 50 }, { id: 2, short: "B", votes: 49 }] }),
    ];
    expect(closeWards(ws, 5).map((c) => c.ward.number)).toEqual([3, 1]);
  });
});
