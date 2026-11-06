import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectDrift } from "./drift";
import { councilStatus, normaliseMunic, normaliseNational, normalisePartyList, normaliseProvince, splitMunicipalityName } from "./normalise";
import { OTHER_ID } from "./types";

const fx = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures", f), "utf8")) as unknown;
const lookup = normalisePartyList(fx("partylist.json"));

describe("national file", () => {
  const nat = normaliseNational(fx("2026/national.json"), lookup);

  it("reads every province and municipality", () => {
    expect(nat.eeid).toBe(1887);
    expect(nat.provinces).toHaveLength(9);
    expect(nat.councils).toHaveLength(213);
    expect(nat.councils.filter((c) => c.kind === "metro")).toHaveLength(8);
  });

  it("national party rows (including OTHER) sum to valid votes cast", () => {
    const sum = nat.parties.reduce((a, p) => a + p.votes, 0);
    expect(sum).toBe(nat.totals.valid);
    expect(nat.parties.some((p) => p.id === OTHER_ID)).toBe(true);
  });

  it("classifies declared councils consistently with the IEC province counters", () => {
    // The national top-level counters can run a council or two ahead of the nested records in
    // the same file (130 vs 129 declared in the 6 Nov fixture), so compare with province sums.
    const sum = (k: "hung" | "majority") => nat.provinces.reduce((a, p) => a + p[k], 0);
    const declared = nat.councils.filter((c) => c.declared);
    expect(declared.filter((c) => c.status === "hung").length).toBe(sum("hung"));
    expect(declared.filter((c) => c.status === "majority").length).toBe(sum("majority"));
    expect(Math.abs(declared.length - nat.progress.municsComplete)).toBeLessThanOrEqual(3);
    expect(nat.councils.filter((c) => !c.declared).every((c) => c.status === "counting")).toBe(true);
  });

  it("uses short party codes", () => {
    expect(nat.parties.find((p) => p.id === 7)?.short).toBe("ANC");
    expect(nat.parties.find((p) => p.id === 1511)?.short).toBe("ActionSA");
  });
});

describe("province file", () => {
  it("has a full party list summing to valid votes", () => {
    const p = normaliseProvince(fx("2026/province3.json"), lookup);
    expect(p.name).toBe("Gauteng");
    expect(p.parties.reduce((a, x) => a + x.votes, 0)).toBe(p.totals.valid);
    expect(p.progress.vdsExpected).toBeGreaterThan(p.progress.vdsComplete);
  });
});

describe("municipality file", () => {
  it("parses a metro with wards and candidates", () => {
    const m = normaliseMunic(fx("2026/munic1001.json"), lookup);
    expect(m.code).toBe("NMA");
    expect(m.name).toBe("Nelson Mandela Bay");
    expect(m.kind).toBe("metro");
    expect(m.wards).toHaveLength(m.progress.wardsExpected);
    expect(m.parties.length).toBeGreaterThan(10);
    const declaredWard = m.wards.find((w) => w.declared);
    expect(declaredWard?.parties[0]?.candidate).toBeTruthy();
  });

  it("parses a declared council with seats summing to the council size", () => {
    const m = normaliseMunic(fx("2026/munic6046.json"), lookup);
    expect(m.declared).toBe(true);
    expect(m.parties.reduce((a, p) => a + p.seats, 0)).toBe(m.totalSeats);
    expect(m.status).toBe("hung");
  });
});

describe("drift handling", () => {
  it("drops malformed records and reports them, without throwing", () => {
    const raw = fx("2026/national.json") as { PartyBallotResults: unknown[] };
    const broken = { ...raw, PartyBallotResults: [...raw.PartyBallotResults, { ID: "not a number" }], NewField: 1 };
    const { value, warnings } = collectDrift(() => normaliseNational(broken, lookup));
    expect(value.parties.length).toBe(raw.PartyBallotResults.length);
    expect(warnings.some((w) => w.includes("dropped a record"))).toBe(true);
  });

  it("reports missing expected fields", () => {
    const raw = fx("2026/national.json") as Record<string, unknown>;
    const copy = { ...raw };
    delete copy.HungCouncils;
    const { value, warnings } = collectDrift(() => normaliseNational(copy, lookup));
    expect(value.hung).toBe(0);
    expect(warnings.some((w) => w.includes("HungCouncils"))).toBe(true);
  });
});

describe("helpers", () => {
  it("splits IEC municipality names", () => {
    expect(splitMunicipalityName("EC442 - Umzimvubu", 1031)).toEqual({ code: "EC442", name: "Umzimvubu" });
    expect(splitMunicipalityName("NC062 - NAMA KHOI", 1)).toEqual({ code: "NC062", name: "Nama Khoi" });
  });
  it("treats exactly half the seats as hung", () => {
    expect(councilStatus(true, 40, 20)).toBe("hung");
    expect(councilStatus(true, 41, 21)).toBe("majority");
    expect(councilStatus(false, 41, 30)).toBe("counting");
  });
});
