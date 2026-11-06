/**
 * Count Room's own types, normalised from the IEC feed. Everything downstream of lib/iec/client.ts
 * uses these, never the raw IEC shapes.
 */

/** Party ID the IEC uses for its aggregated "OTHER" row. */
export const OTHER_ID = -2;
/** Party ID the IEC uses for independent ward candidates. */
export const IND_ID = 0;

export interface PartyResult {
  id: number;
  /** Full IEC name, e.g. "AFRICAN NATIONAL CONGRESS". */
  name: string;
  /** Short code, e.g. "ANC" (from PartyList.js, with our casing overrides). */
  short: string;
  /** Valid votes on the ward and PR ballots combined (IEC TotalValidVotes). */
  votes: number;
  /** IEC PercOfVotes: votes / valid votes cast on both ballots, in percentage points. */
  pct: number;
  wardVotes: number;
  prVotes: number;
  wardSeats: number;
  prSeats: number;
  seats: number;
  /** Councils won / outright majorities: only meaningful at national and province level. */
  councilsWon?: number;
  majoritiesWon?: number;
  /** Ward ballot only: the candidate's name. */
  candidate?: string;
}

export interface Progress {
  vdsComplete: number;
  vdsExpected: number;
  wardsComplete: number;
  wardsExpected: number;
  seatsComplete: number;
  seatsExpected: number;
  municsComplete: number;
  municsExpected: number;
}

export interface BallotTotals {
  registered: number;
  /** Ballots cast (ward + PR combined, as the IEC reports it). */
  cast: number;
  valid: number;
  spoilt: number;
  special: number;
}

export type CouncilKind = "metro" | "local";

export type CouncilStatus = "hung" | "majority" | "counting";

export interface CouncilSummary {
  id: number;
  /** IEC code, e.g. "NMA" or "EC442". */
  code: string;
  /** Display name without the code, e.g. "Nelson Mandela Bay". */
  name: string;
  kind: CouncilKind;
  provinceId: number;
  province: string;
  reportDate: string;
  progress: Progress;
  totals: BallotTotals;
  /** True once the IEC has declared the council (all seats allocated). */
  declared: boolean;
  status: CouncilStatus;
  /** IEC flagged this council as needing a draw (tie) in seat allocation. */
  drawn: boolean;
  totalSeats: number;
  /**
   * The leading party in this council: by seats once declared, by votes while counting.
   * The national Lite file only carries the top one or two parties per council.
   */
  leader: PartyResult | null;
  /** Seats held by the leader (declared councils only). */
  leaderSeats: number;
}

export interface ProvinceSummary {
  id: number;
  name: string;
  reportDate: string;
  progress: Progress;
  totals: BallotTotals;
  hung: number;
  majority: number;
  /** The Lite file lists only the top three parties per province. */
  parties: PartyResult[];
}

export interface NationalData {
  eeid: number;
  reportDate: string;
  progress: Progress;
  totals: BallotTotals;
  hung: number;
  majority: number;
  drawn: number;
  deadlockDrawn: number;
  /** IEC "RegPop": registered voters. */
  registered: number;
  /** National party totals: the top parties plus an "OTHER" row (ID -2). */
  parties: PartyResult[];
  provinces: ProvinceSummary[];
  councils: CouncilSummary[];
}

/** One province file: complete-enough party list for that province (top 13 plus OTHER). */
export interface ProvinceData {
  id: number;
  name: string;
  reportDate: string;
  progress: Progress;
  totals: BallotTotals;
  parties: PartyResult[];
}

export interface WardPartyResult {
  id: number;
  short: string;
  /** Ward-ballot votes. */
  votes: number;
  candidate?: string;
}

/** Compact [partyId, votes] pairs, zero-vote parties removed. */
export type VotePairs = [number, number][];

export interface VotingDistrict {
  id: number;
  /** Valid votes (ward + PR ballots) counted in this district. */
  valid: number;
  /** Votes by party, ward + PR ballots combined (IEC TotalValidVotes at VD level). */
  votes: VotePairs;
}

export interface Ward {
  id: number;
  /** Ward number within the council (last three digits of the IEC ward ID). */
  number: number;
  reportDate: string;
  /** A party or independent has been awarded the ward seat. */
  declared: boolean;
  /** Valid ward-ballot votes counted so far. */
  valid: number;
  vdsReported: number;
  vdsTotal: number;
  /** Ward-ballot results, sorted by votes, parties with zero votes removed. */
  parties: WardPartyResult[];
  /** Ward + PR ballot votes by party in this ward (for share and swing). */
  combined: VotePairs;
  vds: VotingDistrict[];
}

export interface MunicData extends CouncilSummary {
  /** Full party list for the council, sorted by votes. */
  parties: PartyResult[];
  wards: Ward[];
}

/** What every data getter returns: the data plus where and when it came from. */
export interface Sourced<T> {
  data: T;
  /** When our server last fetched this from the IEC (ISO). */
  fetchedAt: string;
  /** True if the IEC failed and this is an older copy. */
  stale: boolean;
  source: "live" | "fixtures" | "memory" | "snapshot";
  warnings: string[];
}

/** A previous election's results for one council, indexed for comparison by voting district. */
export interface PreviousCouncil {
  id: number;
  year: number;
  reportDate: string;
  totalSeats: number;
  /** Council-level result. */
  parties: { id: number; short: string; pct: number; seats: number; votes: number }[];
  /** Voting district ID -> votes by party (ward + PR ballots combined). */
  vds: Record<number, VotePairs>;
  /** Voting district ID -> ward ID in that election. */
  vdWard: Record<number, number>;
}
