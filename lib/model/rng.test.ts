import { describe, expect, it } from "vitest";
import { gaussian, hashSeed, mulberry32, percentile } from "./rng";

describe("rng", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("produces uniforms in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("produces standard normals (mean ~0, sd ~1)", () => {
    const z = gaussian(mulberry32(1));
    const n = 50_000;
    let s = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      const x = z();
      s += x;
      s2 += x * x;
    }
    const mean = s / n;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(Math.sqrt(s2 / n - mean * mean) - 1)).toBeLessThan(0.02);
  });

  it("hashes strings stably", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });

  it("interpolates percentiles", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(percentile(xs, 0)).toBe(1);
    expect(percentile(xs, 50)).toBe(3);
    expect(percentile(xs, 100)).toBe(5);
    expect(percentile(xs, 25)).toBe(2);
  });
});
