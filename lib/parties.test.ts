import { describe, expect, it } from "vitest";
import { FALLBACK_COLOURS, PARTY_COLOURS, buildPartyLookup, partyColour, shortName, titleCase } from "./parties";
import { THEME_BG } from "./theme";

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("party colours", () => {
  const all = [...Object.entries(PARTY_COLOURS).map(([id, c]) => [`party ${id}`, c] as const),
    ...FALLBACK_COLOURS.map((c, i) => [`fallback ${i}`, c] as const)];

  it.each(all)("%s has >= 3:1 contrast against both theme backgrounds", (_label, c) => {
    expect(contrast(c.light, THEME_BG.light)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.light, THEME_BG.lightSurface)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.dark, THEME_BG.dark)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.dark, THEME_BG.darkSurface)).toBeGreaterThanOrEqual(3);
  });

  it("resolves curated and fallback colours to CSS variables", () => {
    expect(partyColour(7)).toBe("var(--party-7)");
    expect(partyColour(-2)).toBe("var(--party-m2)");
    expect(partyColour(123456)).toMatch(/^var\(--party-fb-\d\)$/);
  });
});

describe("short names", () => {
  const lookup = buildPartyLookup([
    { ID: 2168, Name: "KAG", PartyFullName: "KIMBERLEY ACTION GROUP" },
    { ID: 84, Name: "BO", PartyFullName: "BREEDEVALLEI ONAFHANKLIK" },
  ]);
  it("prefers overrides, then IEC abbreviations, then the IEC name", () => {
    expect(shortName(1511, "ACTIONSA", lookup)).toBe("ActionSA");
    expect(shortName(2168, "KIMBERLEY ACTION GROUP", lookup)).toBe("KAG");
    expect(shortName(99999, "SOME NEW PARTY", lookup)).toBe("Some New Party");
    expect(shortName(99998, undefined, lookup)).toBe("Party 99998");
  });
  it("title-cases names", () => {
    expect(titleCase("PAN AFRICANIST CONGRESS OF AZANIA")).toBe("Pan Africanist Congress of Azania");
  });
});
