/**
 * Party short codes and colours.
 *
 * Short codes come from the IEC PartyList.js abbreviations, with casing overrides below. Colours
 * follow a party's conventional colour where one exists, and otherwise are chosen to be
 * distinguishable. Every colour is checked (lib/parties.test.ts) for at least 3:1 contrast against
 * the page background in both light and dark themes. The ten largest parties were also run through a
 * colour-vision-deficiency separation check in vote order; MKP/EFF is the closest pair (ΔE ≈ 7), so
 * colour is never the only cue: party codes are always printed next to swatches and bars, and
 * stacked segments are separated by gaps.
 */
import { IND_ID, OTHER_ID } from "./iec/types";

/** Casing and naming overrides for IEC abbreviations. Keyed by IEC party ID. */
const SHORT_OVERRIDES: Record<number, string> = {
  7: "ANC",
  52: "DA",
  1748: "MKP",
  945: "EFF",
  3: "IFP",
  957: "PA",
  4: "VF Plus",
  1511: "ActionSA",
  445: "SACP",
  1318: "ATM",
  6: "UDM",
  1368: "GOOD",
  18: "ACDP",
  330: "AIC",
  8: "PAC",
  1755: "RISE",
  1711: "BOSA",
  447: "Al Jama-ah",
  499: "COPE",
  17: "AZAPO",
  1492: "NCC",
  [IND_ID]: "Independents",
  [OTHER_ID]: "Other",
};

/** IEC abbreviations that are all caps but read better in title case. */
const TITLE_CASE_IF_LONGER_THAN = 6;

export interface PartyColour {
  light: string;
  dark: string;
}

/** Curated colours, keyed by IEC party ID. */
export const PARTY_COLOURS: Record<number, PartyColour> = {
  7: { light: "#15803d", dark: "#16a34a" }, // ANC: green
  52: { light: "#1d4ed8", dark: "#3b82f6" }, // DA: blue
  1748: { light: "#854d0e", dark: "#c9a227" }, // MKP: black/gold, shown as gold
  945: { light: "#e11d48", dark: "#f43f5e" }, // EFF: red
  4: { light: "#ea580c", dark: "#e8661a" }, // VF Plus: orange
  3: { light: "#c026d3", dark: "#d946ef" }, // IFP
  957: { light: "#7c3aed", dark: "#8b5cf6" }, // PA
  1511: { light: "#0d9488", dark: "#0d9f8f" }, // ActionSA
  445: { light: "#be185d", dark: "#ec4899" }, // SACP
  1318: { light: "#0284c7", dark: "#0b94d1" }, // ATM
  6: { light: "#4d7c0f", dark: "#a3e635" }, // UDM
  1368: { light: "#0e7490", dark: "#67e8f9" }, // GOOD
  18: { light: "#1e3a8a", dark: "#93c5fd" }, // ACDP
  8: { light: "#166534", dark: "#86efac" }, // PAC
  1755: { light: "#7e22ce", dark: "#d8b4fe" }, // RISE
  330: { light: "#854d0e", dark: "#e8b04a" }, // AIC
  [IND_ID]: { light: "#475569", dark: "#94a3b8" }, // Independents: slate
  [OTHER_ID]: { light: "#6b7280", dark: "#9ca3af" }, // Other: grey
};

/** For parties without a curated colour; picked by a stable hash of the party ID. */
export const FALLBACK_COLOURS: PartyColour[] = [
  { light: "#4338ca", dark: "#a5b4fc" },
  { light: "#be123c", dark: "#fda4af" },
  { light: "#047857", dark: "#6ee7b7" },
  { light: "#a21caf", dark: "#f0abfc" },
  { light: "#1e40af", dark: "#93c5fd" },
  { light: "#9a3412", dark: "#fdba74" },
  { light: "#57534e", dark: "#d6d3d1" },
  { light: "#3f6212", dark: "#bef264" },
];

export function fallbackIndex(id: number): number {
  // Small integer hash (Knuth multiplicative), stable across runs.
  const h = Math.imul(Math.abs(id) + 1, 2654435761) >>> 0;
  return h % FALLBACK_COLOURS.length;
}

/** CSS colour expression for a party, resolving to the right theme via CSS variables. */
export function partyColour(id: number): string {
  if (PARTY_COLOURS[id]) return `var(--party-${cssId(id)})`;
  return `var(--party-fb-${fallbackIndex(id)})`;
}

function cssId(id: number): string {
  return id < 0 ? `m${-id}` : String(id);
}

/** The CSS custom properties for every party colour, light and dark. */
export function partyColourCss(): string {
  const light: string[] = [];
  const dark: string[] = [];
  for (const [id, c] of Object.entries(PARTY_COLOURS)) {
    light.push(`--party-${cssId(Number(id))}:${c.light};`);
    dark.push(`--party-${cssId(Number(id))}:${c.dark};`);
  }
  FALLBACK_COLOURS.forEach((c, i) => {
    light.push(`--party-fb-${i}:${c.light};`);
    dark.push(`--party-fb-${i}:${c.dark};`);
  });
  return `:root{${light.join("")}}@media (prefers-color-scheme: dark){:root{${dark.join("")}}}`;
}

export interface PartyLookupEntry {
  abbr: string;
  full: string;
}

export type PartyLookup = Map<number, PartyLookupEntry>;

export function buildPartyLookup(list: { ID: number; Name?: string; PartyFullName?: string }[]): PartyLookup {
  const m: PartyLookup = new Map();
  for (const p of list) {
    if (p.Name || p.PartyFullName) m.set(p.ID, { abbr: p.Name ?? "", full: p.PartyFullName ?? "" });
  }
  return m;
}

/**
 * Short display code for a party. Order: our override, the IEC abbreviation, then the IEC name.
 */
export function shortName(id: number, iecName: string | undefined, lookup?: PartyLookup): string {
  const o = SHORT_OVERRIDES[id];
  if (o) return o;
  const abbr = lookup?.get(id)?.abbr?.trim();
  if (abbr) return abbr.length > TITLE_CASE_IF_LONGER_THAN ? titleCase(abbr) : abbr;
  const name = iecName?.trim();
  if (name) return titleCase(name);
  return `Party ${id}`;
}

/** Full names where title-casing the IEC name reads wrongly. */
const DISPLAY_OVERRIDES: Record<number, string> = {
  1511: "ActionSA",
  4: "Freedom Front Plus (VF Plus)",
  1748: "uMkhonto weSizwe Party",
  1368: "GOOD",
  445: "South African Communist Party",
  957: "Patriotic Alliance",
};

/** Full name in readable case, e.g. "African National Congress". */
export function displayName(iecName: string | undefined, id: number): string {
  if (id === IND_ID) return "Independent candidates";
  if (id === OTHER_ID) return "All other parties";
  if (DISPLAY_OVERRIDES[id]) return DISPLAY_OVERRIDES[id];
  return iecName ? titleCase(iecName.trim()) : `Party ${id}`;
}

const SMALL = new Set(["of", "the", "and", "for", "in", "to", "a"]);

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((w, i) => {
      if (!w.trim() || w === "-" || w === "/") return w;
      if (i > 0 && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
}
