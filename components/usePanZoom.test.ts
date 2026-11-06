import { describe, expect, it } from "vitest";
import { clampView, MAX_ZOOM, parseViewBox, zoomAbout, type View } from "./usePanZoom";

const base: View = [0, 0, 1000, 800];

describe("map zoom maths", () => {
  it("parses a viewBox", () => {
    expect(parseViewBox("10 20 300 400")).toEqual([10, 20, 300, 400]);
  });

  it("zooms about the given point, keeping it fixed on screen", () => {
    const v = zoomAbout(base, base, 2, 250, 200);
    expect(v).toEqual([125, 100, 500, 400]);
    // The point keeps its relative position in the view.
    expect((250 - v[0]) / v[2]).toBeCloseTo(250 / 1000, 9);
    expect((200 - v[1]) / v[3]).toBeCloseTo(200 / 800, 9);
  });

  it("never zooms out past the whole map, or in past the limit", () => {
    expect(zoomAbout(base, base, 0.5, 500, 400)).toEqual(base);
    let v = base;
    for (let i = 0; i < 20; i++) v = zoomAbout(v, base, 2, 500, 400);
    expect(base[2] / v[2]).toBeCloseTo(MAX_ZOOM, 9);
  });

  it("keeps the view on the map when panning", () => {
    expect(clampView([-200, -50, 500, 400], base)).toEqual([0, 0, 500, 400]);
    expect(clampView([900, 700, 500, 400], base)).toEqual([500, 400, 500, 400]);
  });

  it("zooming near an edge stays inside the map", () => {
    const v = zoomAbout(base, base, 3, 990, 790);
    expect(v[0] + v[2]).toBeLessThanOrEqual(1000 + 1e-9);
    expect(v[1] + v[3]).toBeLessThanOrEqual(800 + 1e-9);
  });
});
