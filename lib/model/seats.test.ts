import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseMunic } from "../iec/normalise";
import { IND_ID } from "../iec/types";
import { buildCouncilSimInput } from "./inputs";
import { allocateMixedMember, allocateSeats, droopQuota, majorityLine } from "./seats";
import { mulberry32 } from "./rng";

const fx = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures", f), "utf8")) as unknown;

/** Councils that were declared when the fixtures were taken (6 Nov 2026). */
const DECLARED = [
  { id: 6046, name: "Sol Plaatje" },
  { id: 9912, name: "Breede Valley" },
  { id: 4457, name: "KwaDukuza" },
];

describe("allocateSeats (Droop, largest remainder)", () => {
  it("computes the Droop quota", () => {
    expect(droopQuota(1000, 9)).toBe(101);
  });

  it("always allocates exactly the available seats", () => {
    const rnd = mulberry32(11);
    for (let t = 0; t < 500; t++) {
      const seats = 5 + Math.floor(rnd() * 270);
      const parties = Array.from({ length: 1 + Math.floor(rnd() * 40) }, (_, i) => ({ id: i, votes: Math.floor(rnd() ** 3 * 200_000) }));
      if (parties.every((p) => p.votes === 0)) continue;
      const res = allocateSeats(parties, seats);
      expect(res.reduce((a, r) => a + r.seats, 0)).toBe(seats);
      for (const r of res) expect(r.seats).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives nothing when there are no votes", () => {
    expect(allocateSeats([{ id: 1, votes: 0 }], 10)).toEqual([{ id: 1, seats: 0 }]);
  });

  it("is proportional in a simple case", () => {
    const res = allocateSeats([{ id: 1, votes: 600 }, { id: 2, votes: 300 }, { id: 3, votes: 100 }], 10);
    expect(res.map((r) => r.seats)).toEqual([6, 3, 1]);
  });
});

describe("allocateMixedMember (Schedule 1)", () => {
  it("lets a party keep ward seats beyond its proportional share (overhang)", () => {
    const res = allocateMixedMember({
      parties: [
        { id: 1, votes: 4000, wardSeats: 6 },
        { id: 2, votes: 4000, wardSeats: 0 },
        { id: 3, votes: 2000, wardSeats: 0 },
      ],
      seats: 10,
    });
    const s = Object.fromEntries(res.map((r) => [r.id, r]));
    expect(s[1]!.seats).toBe(6);
    expect(s[1]!.overhang).toBe(true);
    expect(s[1]!.prSeats).toBe(0);
    expect(s[2]!.seats + s[3]!.seats).toBe(4);
  });

  it("always allocates exactly the available seats when nobody overhangs", () => {
    const rnd = mulberry32(5);
    for (let t = 0; t < 300; t++) {
      const seats = 9 + Math.floor(rnd() * 260);
      const parties = Array.from({ length: 2 + Math.floor(rnd() * 30) }, (_, i) => ({ id: i, votes: 1 + Math.floor(rnd() ** 2 * 100_000), wardSeats: 0 }));
      const res = allocateMixedMember({ parties, seats });
      expect(res.reduce((a, r) => a + r.seats, 0)).toBe(seats);
    }
  });
});

describe.each(DECLARED)("declared council $name ($id)", ({ id }) => {
  const m = normaliseMunic(fx(`2026/munic${id}.json`));
  const actual = new Map(m.parties.map((p) => [p.id, p.seats]));
  const ind = m.parties.find((p) => p.id === IND_ID)?.wardSeats ?? 0;

  it("is declared in the fixture", () => {
    expect(m.declared).toBe(true);
    expect([...actual.values()].reduce((a, v) => a + v, 0)).toBe(m.totalSeats);
  });

  it("Droop approximation on PR votes reproduces every party within ±1 seat", () => {
    const input = buildCouncilSimInput(m, "droop");
    const res = allocateSeats(input.parties, m.totalSeats - ind);
    expect(res.reduce((a, r) => a + r.seats, 0) + ind).toBe(m.totalSeats);
    for (const r of res) expect(Math.abs(r.seats - (actual.get(r.id) ?? 0))).toBeLessThanOrEqual(1);
  });

  it("mixed-member formula reproduces the declared seats exactly", () => {
    const input = buildCouncilSimInput(m, "mmp");
    const res = allocateMixedMember({ parties: input.parties, seats: m.totalSeats, independentWardSeats: ind });
    expect(res.reduce((a, r) => a + r.seats, 0) + ind).toBe(m.totalSeats);
    for (const r of res) expect(r.seats).toBe(actual.get(r.id) ?? 0);
  });
});

describe("majorityLine", () => {
  it("is floor(seats/2)+1", () => {
    expect(majorityLine(120)).toBe(61);
    expect(majorityLine(41)).toBe(21);
  });
});
