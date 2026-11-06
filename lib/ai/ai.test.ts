import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("next/server", () => ({ after: () => {} }));

import { normaliseMunic, normaliseNational, normaliseProvince } from "../iec/normalise";
import { analyseCouncil } from "../model/council";
import { buildProjectionInput } from "../model/inputs";
import { projectNational } from "../model/projection";
import { councilContext, nationalContext, SYSTEM_INSTRUCTIONS } from "./context";
import { normaliseQuestion, rateLimited } from "./ask";

const fx = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures", f), "utf8")) as unknown;

describe("AI context", () => {
  const nat = normaliseNational(fx("2026/national.json"));
  const provs = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => normaliseProvince(fx(`2026/province${i}.json`)));
  const ctx = nationalContext(nat, projectNational(buildProjectionInput(nat, provs)), provs[0]!.reportDate);

  it("includes the report time, every council and the projection", () => {
    expect(ctx).toContain(nat.reportDate);
    for (const c of nat.councils.slice(0, 20)) expect(ctx).toContain(`${c.code} ${c.name}`);
    expect(ctx).toContain("# Projection");
  });

  it("stays a reasonable size for every request", () => {
    expect(ctx.length).toBeLessThan(40_000); // ~10k tokens
  });

  it("council context carries seats and coalitions", () => {
    const m = normaliseMunic(fx("2026/munic1001.json"));
    const c = councilContext(m, analyseCouncil(m, "droop"), null, null);
    expect(c).toContain("Nelson Mandela Bay");
    expect(c).toContain("majority line 61");
    expect(c).toContain("Minimal winning combinations");
  });

  it("instructions forbid prediction and partisanship", () => {
    expect(SYSTEM_INSTRUCTIONS).toMatch(/Do not predict/);
    expect(SYSTEM_INSTRUCTIONS).toMatch(/neutral/);
  });
});

describe("AI guard rails", () => {
  it("rate-limits a visitor after six questions in ten minutes", () => {
    const t = 1_000_000;
    for (let i = 0; i < 6; i++) expect(rateLimited("1.2.3.4", t + i)).toBe(false);
    expect(rateLimited("1.2.3.4", t + 10)).toBe(true);
    expect(rateLimited("5.6.7.8", t + 10)).toBe(false);
    expect(rateLimited("1.2.3.4", t + 11 * 60_000)).toBe(false);
  });

  it("normalises and caps questions", () => {
    expect(normaliseQuestion("  how   many\nhung? ")).toBe("how many hung?");
    expect(normaliseQuestion("x".repeat(500))).toHaveLength(300);
  });
});
