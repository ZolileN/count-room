import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseMunic } from "../iec/normalise";
import { analyseCouncil } from "./council";
import {
  coalitionProbabilities,
  combinations,
  minimalWinningCoalitions,
  simulateCouncil,
  type SeatHolder,
} from "./coalitions";
import { allocateMixedMember, allocateSeats, majorityLine } from "./seats";
import { buildCouncilSimInput } from "./inputs";

const fx = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures", f), "utf8")) as unknown;

function assertMinimal(cs: { members: number[]; seats: number }[], holders: SeatHolder[], total: number) {
  const seats = new Map(holders.map((h) => [h.id, h.seats]));
  const need = majorityLine(total);
  for (const c of cs) {
    const sum = c.members.reduce((a, id) => a + seats.get(id)!, 0);
    expect(sum).toBe(c.seats);
    expect(sum).toBeGreaterThanOrEqual(need);
    for (const id of c.members) expect(sum - seats.get(id)!).toBeLessThan(need);
  }
}

describe("combinations", () => {
  it("enumerates n choose k", () => {
    expect([...combinations([1, 2, 3, 4], 2)]).toEqual([[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]);
    expect([...combinations([1, 2], 3)]).toEqual([]);
  });
});

describe("minimalWinningCoalitions", () => {
  const holders = [
    { id: 1, seats: 40 },
    { id: 2, seats: 30 },
    { id: 3, seats: 20 },
    { id: 4, seats: 9 },
    { id: 5, seats: 1 },
  ];
  const res = minimalWinningCoalitions(holders, 100);

  it("finds exactly the minimal winning sets (worked by hand: need 51 of 100)", () => {
    expect(res).toEqual([
      { members: [1, 2], seats: 70 },
      { members: [1, 3], seats: 60 },
      { members: [2, 3, 4], seats: 59 },
      { members: [2, 3, 5], seats: 51 },
    ]);
  });

  it("every coalition is minimal: removing any member drops below the majority", () => {
    assertMinimal(res, holders, 100);
    // {2,3,4,5} = 60 wins but is not minimal (drop 5 and it still has 59).
    expect(res.some((c) => c.members.length === 4)).toBe(false);
  });

  it("returns a single party with an outright majority on its own, and nothing containing it", () => {
    const r = minimalWinningCoalitions([{ id: 1, seats: 60 }, { id: 2, seats: 30 }, { id: 3, seats: 10 }], 100);
    expect(r[0]).toEqual({ members: [1], seats: 60 });
    expect(r.filter((c) => c.members.includes(1))).toHaveLength(1);
    assertMinimal(r, [{ id: 1, seats: 60 }, { id: 2, seats: 30 }, { id: 3, seats: 10 }], 100);
  });

  it("respects maxSize, topN and exclusions", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, seats: 10 }));
    const r = minimalWinningCoalitions(many, 140, { maxSize: 4 });
    expect(r.every((c) => c.members.length <= 4)).toBe(true);
    // 4 × 10 = 40 < 71: nobody wins with four.
    expect(r).toHaveLength(0);
    const r2 = minimalWinningCoalitions(holders, 100, { exclude: [1] });
    expect(r2.every((c) => !c.members.includes(1))).toBe(true);
    const r3 = minimalWinningCoalitions(many, 40, { topN: 10 });
    expect(r3.every((c) => c.members.every((id) => id <= 10))).toBe(true);
  });

  it("handles exact ties at half the seats as not winning", () => {
    const r = minimalWinningCoalitions([{ id: 1, seats: 20 }, { id: 2, seats: 20 }, { id: 3, seats: 1 }], 41);
    expect(r.map((c) => c.members)).toEqual([[1, 2], [1, 3], [2, 3]]);
    const tie = minimalWinningCoalitions([{ id: 1, seats: 20 }, { id: 2, seats: 20 }], 40);
    expect(tie.map((c) => c.members)).toEqual([[1, 2]]);
  });
});

describe("coalition probabilities", () => {
  it("are 1 or 0 when counting is complete, and stable for the same data", () => {
    const input = {
      parties: [
        { id: 1, votes: 4500, wardSeats: 0 },
        { id: 2, votes: 3500, wardSeats: 0 },
        { id: 3, votes: 2000, wardSeats: 0 },
      ],
      totalSeats: 50,
      vdsComplete: 10,
      vdsExpected: 10,
      model: "droop" as const,
    };
    const sim = simulateCouncil(input);
    expect(sim.sims).toBe(1);
    const holders = sim.ids.map((id) => ({ id, seats: sim.seats.get(id)! }));
    const cs = coalitionProbabilities(minimalWinningCoalitions(holders, 50), sim, 50);
    for (const c of cs) expect(c.probability).toBe(1);

    const counting = { ...input, vdsComplete: 4 };
    const a = simulateCouncil(counting);
    const b = simulateCouncil(counting);
    expect(a.sims).toBe(2000);
    expect(a.draws).toEqual(b.draws);
    for (const d of a.draws) expect(d.reduce((x, y) => x + y, 0)).toBe(50);
  });
});

describe("analyseCouncil on fixtures", () => {
  it("uses declared seats for a declared council", () => {
    const m = normaliseMunic(fx("2026/munic6046.json"));
    const a = analyseCouncil(m, "droop");
    expect(a.seatsSource).toBe("declared");
    expect(a.rows.reduce((x, r) => x + r.seats, 0)).toBe(m.totalSeats);
    assertMinimal(a.coalitions, a.rows, a.totalSeats);
  });

  it("modelled point seats equal a direct allocation of the counted votes (regression: shares vs votes)", () => {
    const m = normaliseMunic(fx("2026/munic1001.json"));
    for (const model of ["droop", "mmp"] as const) {
      const input = buildCouncilSimInput(m, model);
      const sim = simulateCouncil(input, 50);
      const direct =
        model === "droop"
          ? allocateSeats(input.parties, input.totalSeats - (input.independentWardSeats ?? 0))
          : allocateMixedMember({ parties: input.parties, seats: input.totalSeats, independentWardSeats: input.independentWardSeats ?? 0 });
      for (const d of direct) expect(sim.seats.get(d.id)).toBe(d.seats);
      // A party with well under half a quota of votes cannot win a seat.
      const total = input.parties.reduce((a, p) => a + p.votes, 0);
      const tiny = input.parties.filter((p) => p.votes / total < 0.2 / input.totalSeats && p.wardSeats === 0);
      expect(tiny.length).toBeGreaterThan(0);
      for (const p of tiny) expect(sim.seats.get(p.id)).toBe(0);
      // Simulated draws stay close to the point estimate for the largest party.
      const big = input.parties[0]!.id;
      const r = sim.ranges.get(big)!;
      expect(Math.abs(r.p50 - sim.seats.get(big)!)).toBeLessThanOrEqual(2);
    }
  });

  it("models seats for a council still counting", () => {
    const m = normaliseMunic(fx("2026/munic1001.json"));
    expect(m.declared).toBe(false);
    const a = analyseCouncil(m, "droop");
    expect(a.seatsSource).toBe("model");
    expect(a.rows.reduce((x, r) => x + r.seats, 0)).toBe(m.totalSeats);
    assertMinimal(a.coalitions, a.rows, a.totalSeats);
    for (const c of a.coalitions) expect(c.probability).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < a.coalitions.length; i++) {
      const [p, q] = [a.coalitions[i - 1]!, a.coalitions[i]!];
      expect(p.members.length < q.members.length || (p.members.length === q.members.length && p.probability >= q.probability)).toBe(true);
    }
  });
});
