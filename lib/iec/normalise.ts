/**
 * Pure functions: raw (Zod-parsed) IEC objects -> Count Room types. No I/O here.
 */
import { checkFields, drift } from "./drift";
import {
  EXPECTED_PARTY_FIELDS,
  EXPECTED_TOP_LEVEL,
  MunicFileSchema,
  NationalFileSchema,
  PartyListSchema,
  ProvinceFileSchema,
  summariseIssues,
  type RawMunicipalityResult,
  type RawPartyBallotResult,
  type RawWardResult,
} from "./schemas";
import type {
  BallotTotals,
  CouncilKind,
  CouncilStatus,
  CouncilSummary,
  MunicData,
  NationalData,
  PartyResult,
  Progress,
  ProvinceData,
  ProvinceSummary,
  Ward,
} from "./types";
import { buildPartyLookup, shortName, type PartyLookup } from "../parties";
import { METRO_IDS } from "../config";
export { majorityLine } from "../model/seats";

type ProgressSource = Partial<Record<
  | "VDsComplete" | "VDExpected" | "WardsComplete" | "WardExpected" | "SeatsComplete" | "SeatsExpected"
  | "MuncipalitiesComplete" | "MunicExpected",
  number
>>;

const n = (v: number | undefined | null): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function normaliseProgress(o: ProgressSource): Progress {
  return {
    vdsComplete: n(o.VDsComplete),
    vdsExpected: n(o.VDExpected),
    wardsComplete: n(o.WardsComplete),
    wardsExpected: n(o.WardExpected),
    seatsComplete: n(o.SeatsComplete),
    seatsExpected: n(o.SeatsExpected),
    municsComplete: n(o.MuncipalitiesComplete),
    municsExpected: n(o.MunicExpected),
  };
}

/** Area-level ballot totals are repeated on every party row; read them from the first. */
export function normaliseTotals(parties: RawPartyBallotResult[], registeredFallback = 0): BallotTotals {
  const p = parties[0];
  return {
    registered: n(p?.RegisteredVoters) || registeredFallback,
    cast: n(p?.TotalVotesCast),
    valid: n(p?.ValidVotesCast) || parties.reduce((a, x) => a + n(x.TotalValidVotes), 0),
    spoilt: n(p?.SpoiltVotes),
    special: n(p?.SpecialVotes),
  };
}

export function normaliseParty(p: RawPartyBallotResult, lookup?: PartyLookup): PartyResult {
  const out: PartyResult = {
    id: p.ID,
    name: p.Name?.trim() || lookup?.get(p.ID)?.full || `Party ${p.ID}`,
    short: shortName(p.ID, p.Name, lookup),
    votes: n(p.TotalValidVotes),
    pct: n(p.PercOfVotes),
    wardVotes: n(p.WardVotes),
    prVotes: n(p.PRVotes),
    wardSeats: n(p.WardSeatsWon),
    prSeats: n(p.PRSeatsWon),
    seats: n(p.TotalSeatsWon),
  };
  if (p.CouncilsWon !== undefined) out.councilsWon = p.CouncilsWon;
  if (p.MajorityWon !== undefined) out.majoritiesWon = p.MajorityWon;
  if (p.CandidateName) out.candidate = p.CandidateName.trim();
  return out;
}

export function normaliseParties(list: RawPartyBallotResult[], lookup?: PartyLookup): PartyResult[] {
  return list.map((p) => normaliseParty(p, lookup)).sort((a, b) => b.votes - a.votes || a.id - b.id);
}

/** "NMA - Nelson Mandela Bay" -> { code: "NMA", name: "Nelson Mandela Bay" } */
export function splitMunicipalityName(raw: string | undefined, id: number): { code: string; name: string } {
  const s = (raw ?? "").trim();
  const i = s.indexOf(" - ");
  if (i < 0) return { code: String(id), name: s || `Municipality ${id}` };
  const name = s.slice(i + 3).trim();
  // A few names come through in capitals (e.g. "NAMA KHOI"); tidy those.
  const tidy = name === name.toUpperCase() ? name.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : name;
  return { code: s.slice(0, i).trim(), name: tidy };
}

export function councilKind(id: number, code: string): CouncilKind {
  if ((METRO_IDS as readonly number[]).includes(id)) return "metro";
  return /^[A-Z]{3}$/.test(code) ? "metro" : "local";
}

/**
 * Hung = no party holds more than half the seats. Only decided once the council is declared;
 * before that the council is "counting".
 */
export function councilStatus(declared: boolean, totalSeats: number, maxSeats: number): CouncilStatus {
  if (!declared) return "counting";
  return maxSeats > totalSeats / 2 ? "majority" : "hung";
}

function summariseCouncil(m: RawMunicipalityResult, parties: PartyResult[], rawParties: RawPartyBallotResult[]): CouncilSummary {
  const { code, name } = splitMunicipalityName(m.Municipality, m.MunicipalityID);
  const progress = normaliseProgress(m);
  const totalSeats = n(rawParties[0]?.AvailableSeats) || progress.seatsExpected;
  const declared = n(m.MuncipalitiesComplete) >= 1 || n(m.Perc_MunicipalityComplete) >= 100;
  const bySeats = [...parties].sort((a, b) => b.seats - a.seats || b.votes - a.votes);
  const maxSeats = bySeats[0]?.seats ?? 0;

  // Leader: by seats once declared; by votes while counting (ward seats alone mislead early on).
  const flagged = (flag: "IsLeadingPartySeats" | "IsLeadingPartyVotes") => {
    const raw = rawParties.find((p) => p[flag]);
    return raw ? parties.find((p) => p.id === raw.ID) : undefined;
  };
  const leader = declared
    ? (flagged("IsLeadingPartySeats") ?? bySeats[0] ?? null)
    : (flagged("IsLeadingPartyVotes") ?? parties[0] ?? null);

  let status = councilStatus(declared, totalSeats, maxSeats);
  // Cross-check against the IEC's own flags; trust the IEC if they disagree, and say so.
  if (declared) {
    const iecHung = n(m.HungCouncils) >= 1;
    const iecMajority = n(m.MajorityCouncils) >= 1;
    if (iecHung !== iecMajority) {
      const iecStatus: CouncilStatus = iecHung ? "hung" : "majority";
      if (iecStatus !== status && parties.length > 1) {
        drift(`council ${code}: our hung/majority test disagrees with the IEC flag; using the IEC flag`);
      }
      // The Lite file only lists the top party; when it is all we have, the IEC flag decides.
      status = iecStatus;
    }
  }

  return {
    id: m.MunicipalityID,
    code,
    name,
    kind: councilKind(m.MunicipalityID, code),
    provinceId: n(m.ProvinceID),
    province: m.Province ?? "",
    reportDate: m.ReportDate ?? "",
    progress,
    totals: normaliseTotals(rawParties, n(m.RegPop)),
    declared,
    status,
    drawn: n(m.TotalDrawnCouncils) >= 1,
    totalSeats,
    leader,
    leaderSeats: declared ? (leader?.seats ?? 0) : 0,
  };
}

export function normaliseNational(json: unknown, lookup?: PartyLookup): NationalData {
  checkFields("national", json, EXPECTED_TOP_LEVEL);
  const r = NationalFileSchema.safeParse(json);
  if (!r.success) throw new FeedShapeError(`national file: ${summariseIssues(r.error)}`);
  const d = r.data;
  checkFields("national party", d.PartyBallotResults[0], EXPECTED_PARTY_FIELDS);

  const provinces: ProvinceSummary[] = [];
  const councils: CouncilSummary[] = [];
  for (const p of d.ProvinceResults) {
    provinces.push({
      id: p.ProvinceID,
      name: p.Province ?? `Province ${p.ProvinceID}`,
      reportDate: p.ReportDate ?? "",
      progress: normaliseProgress(p),
      totals: normaliseTotals(p.PartyBallotResults, n(p.RegPop)),
      hung: n(p.HungCouncils),
      majority: n(p.MajorityCouncils),
      parties: normaliseParties(p.PartyBallotResults, lookup),
    });
    for (const m of p.MunicipalityResults) {
      const parties = normaliseParties(m.PartyBallotResults, lookup);
      councils.push(summariseCouncil({ ...m, ProvinceID: m.ProvinceID ?? p.ProvinceID, Province: m.Province ?? p.Province }, parties, m.PartyBallotResults));
    }
  }
  if (provinces.length === 0) drift("national file: no provinces");
  if (councils.length === 0) drift("national file: no municipalities");

  return {
    eeid: n(d.ElectoralEventID),
    reportDate: d.ReportDate ?? "",
    progress: normaliseProgress(d),
    totals: normaliseTotals(d.PartyBallotResults, n(d.RegPop)),
    hung: n(d.HungCouncils),
    majority: n(d.MajorityCouncils),
    drawn: n(d.TotalDrawnCouncils),
    deadlockDrawn: n(d.DeadLockDrawnCouncils),
    registered: n(d.RegPop),
    parties: normaliseParties(d.PartyBallotResults, lookup),
    provinces: provinces.sort((a, b) => a.id - b.id),
    councils: councils.sort((a, b) => a.provinceId - b.provinceId || a.code.localeCompare(b.code)),
  };
}

export function normaliseProvince(json: unknown, lookup?: PartyLookup): ProvinceData {
  const r = ProvinceFileSchema.safeParse(json);
  if (!r.success) throw new FeedShapeError(`province file: ${summariseIssues(r.error)}`);
  const d = r.data;
  return {
    id: d.ProvinceID,
    name: d.Province ?? `Province ${d.ProvinceID}`,
    reportDate: d.ReportDate ?? "",
    progress: normaliseProgress(d),
    totals: normaliseTotals(d.PartyBallotResults, n(d.RegPop)),
    parties: normaliseParties(d.PartyBallotResults, lookup),
  };
}

export function normaliseWard(w: RawWardResult, lookup?: PartyLookup): Ward {
  const parties = w.PartyBallotResults
    .map((p) => ({
      id: p.ID,
      short: shortName(p.ID, p.Name, lookup),
      votes: n(p.WardVotes),
      ...(p.CandidateName ? { candidate: p.CandidateName.trim() } : {}),
    }))
    .filter((p) => p.votes > 0)
    .sort((a, b) => b.votes - a.votes || a.id - b.id);
  const vds = w.VotingDistrictResults;
  return {
    id: w.WardID,
    number: w.WardID % 1000,
    reportDate: w.ReportDate ?? "",
    declared: w.PartyBallotResults.some((p) => n(p.WardSeatsWon) > 0),
    valid: parties.reduce((a, p) => a + p.votes, 0),
    vdsReported: vds.filter((v) => v.PartyBallotResults.some((p) => n(p.TotalValidVotes) > 0)).length,
    vdsTotal: vds.length,
    parties,
  };
}

export function normaliseMunic(json: unknown, lookup?: PartyLookup): MunicData {
  const r = MunicFileSchema.safeParse(json);
  if (!r.success) throw new FeedShapeError(`municipality file: ${summariseIssues(r.error)}`);
  const d = r.data;
  checkFields(`municipality ${d.MunicipalityID} party`, d.PartyBallotResults[0], EXPECTED_PARTY_FIELDS);
  const parties = normaliseParties(d.PartyBallotResults, lookup);
  return {
    ...summariseCouncil(d, parties, d.PartyBallotResults),
    parties,
    wards: d.WardResults.map((w) => normaliseWard(w, lookup)).sort((a, b) => a.number - b.number),
  };
}

export function normalisePartyList(json: unknown): PartyLookup {
  const r = PartyListSchema.safeParse(json);
  if (!r.success) throw new FeedShapeError(`party list: ${summariseIssues(r.error)}`);
  return buildPartyLookup(r.data);
}

/** The file parsed as JSON but not as the shape we need. Callers fall back to last-good data. */
export class FeedShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedShapeError";
  }
}
