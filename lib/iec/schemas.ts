/**
 * Zod schemas for the IEC's public results-dashboard files.
 *
 * The feed is undocumented and can change without notice, so every object is loose (unknown keys
 * pass through), almost every field is optional, and arrays are parsed item by item: a malformed
 * record is dropped and reported as drift rather than failing the whole file.
 *
 * Shapes verified against the live feed on 6 Nov 2026 (see README, "Feed notes").
 */
import { z } from "zod";
import { drift } from "./drift";

const num = z.number().optional();
const str = z.string().optional();
const bool = z.boolean().optional();

/** Parse an array item by item, dropping (and reporting) items that fail. */
function tolerantArray<T extends z.ZodType>(item: T, label: string) {
  return z
    .array(z.unknown())
    .optional()
    .transform((items) => {
      const out: z.output<T>[] = [];
      for (const raw of items ?? []) {
        const r = item.safeParse(raw);
        if (r.success) out.push(r.data);
        else drift(`${label}: dropped a record (${summariseIssues(r.error)})`);
      }
      return out;
    });
}

export function summariseIssues(err: z.ZodError): string {
  return err.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

export const PartyBallotResultSchema = z.looseObject({
  ID: z.number(),
  Name: str,
  TotalValidVotes: num,
  PercOfVotes: num,
  WardVotes: num,
  PRVotes: num,
  WardSeatsWon: num,
  PRSeatsWon: num,
  TotalSeatsWon: num,
  AvailableSeats: num,
  CouncilsWon: num,
  MajorityWon: num,
  IsCouncilWinner: bool,
  IsLeadingPartySeats: bool,
  IsLeadingPartyVotes: bool,
  IsLeadingParty: bool,
  IOrder: num,
  RegisteredVoters: num,
  TotalVotesCast: num,
  ValidVotesCast: num,
  SpoiltVotes: num,
  SpecialVotes: num,
  CandidateName: z.string().nullable().optional(),
  Year2000: num,
  Year2006: num,
  Year2011: num,
});
export type RawPartyBallotResult = z.infer<typeof PartyBallotResultSchema>;

/** Completion counters shared by national, province and municipality objects. */
const progressFields = {
  ProvinceExpected: num,
  MunicExpected: num,
  WardExpected: num,
  VDExpected: num,
  SeatsExpected: num,
  ProvincesComplete: num,
  MuncipalitiesComplete: num, // sic, as spelled by the IEC
  WardsComplete: num,
  VDsComplete: num,
  SeatsComplete: num,
  Perc_ProvinceComplete: num,
  Perc_MunicipalityComplete: num,
  Perc_WardsComplete: num,
  Perc_VDsComplete: num,
  Perc_SeatsComplete: num,
  HungCouncils: num,
  DeadLockDrawnCouncils: num,
  MajorityCouncils: num,
  TotalDrawnCouncils: num,
  RegPop: num,
};

export const VotingDistrictResultSchema = z.looseObject({
  VotingDistrictID: z.number(),
  ReportDate: str,
  PartyBallotResults: tolerantArray(PartyBallotResultSchema, "VD party"),
});

export const WardResultSchema = z.looseObject({
  WardID: z.number(),
  ReportDate: str,
  PartyBallotResults: tolerantArray(PartyBallotResultSchema, "ward party"),
  VotingDistrictResults: tolerantArray(VotingDistrictResultSchema, "voting district"),
});
export type RawWardResult = z.infer<typeof WardResultSchema>;

export const MunicipalityResultSchema = z.looseObject({
  MunicipalityID: z.number(),
  Municipality: str,
  ProvinceID: num,
  Province: str,
  ReportDate: str,
  PartyBallotResults: tolerantArray(PartyBallotResultSchema, "municipality party"),
  WardResults: tolerantArray(WardResultSchema, "ward"),
  ...progressFields,
});
export type RawMunicipalityResult = z.infer<typeof MunicipalityResultSchema>;

export const ProvinceResultSchema = z.looseObject({
  ProvinceID: z.number(),
  Province: str,
  ReportDate: str,
  PartyBallotResults: tolerantArray(PartyBallotResultSchema, "province party"),
  MunicipalityResults: tolerantArray(MunicipalityResultSchema, "municipality"),
  ...progressFields,
});
export type RawProvinceResult = z.infer<typeof ProvinceResultSchema>;

/** EEID{n}LiteMapsNational.js */
export const NationalFileSchema = z.looseObject({
  ElectoralEventID: num,
  ReportDate: str,
  PartyBallotResults: tolerantArray(PartyBallotResultSchema, "national party"),
  ProvinceResults: tolerantArray(ProvinceResultSchema, "province"),
  ...progressFields,
});
export type RawNationalFile = z.infer<typeof NationalFileSchema>;

/** EEID{n}Province{id}.js: same shape as one province object, with ElectoralEventID at top. */
export const ProvinceFileSchema = ProvinceResultSchema.extend({ ElectoralEventID: num });
export type RawProvinceFile = z.infer<typeof ProvinceFileSchema>;

/** EEID{n}Munic{id}.js: one municipality object, with ElectoralEventID at top. */
export const MunicFileSchema = MunicipalityResultSchema.extend({ ElectoralEventID: num });
export type RawMunicFile = z.infer<typeof MunicFileSchema>;

/** 2016/PartyList.js (despite the path, it is the current list and includes 2026 parties). */
export const PartyListSchema = tolerantArray(
  z.looseObject({
    ID: z.number(),
    Name: str, // abbreviation
    PartyFullName: str,
    sWebColour: str,
  }),
  "party list entry",
);
export type RawPartyList = z.infer<typeof PartyListSchema>;

/** Fields we rely on. If any disappears from the feed, we log it once. */
export const EXPECTED_TOP_LEVEL = [
  "ReportDate",
  "PartyBallotResults",
  "ProvinceResults",
  "VDExpected",
  "VDsComplete",
  "MuncipalitiesComplete",
  "SeatsExpected",
  "SeatsComplete",
  "HungCouncils",
  "MajorityCouncils",
  "RegPop",
] as const;

export const EXPECTED_PARTY_FIELDS = [
  "TotalValidVotes",
  "PercOfVotes",
  "WardVotes",
  "PRVotes",
  "TotalSeatsWon",
  "AvailableSeats",
  "ValidVotesCast",
] as const;
