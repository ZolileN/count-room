import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { layoutLabels, textWidthPx } from "./labels";
import { numProp, placesWithin, toSvgPaths, type GeoFeature, type PlaceRow } from "./geo";
import placesData from "./geo-data/places.json";

describe("layoutLabels", () => {
  const view: [number, number, number, number] = [0, 0, 1000, 1000];

  it("keeps the higher-scored label when two would collide", () => {
    const out = layoutLabels(
      [
        { name: "Smallville", x: 500, y: 500, score: 1 },
        { name: "Big City", x: 501, y: 501, score: 50 },
      ],
      { upp: 1, view },
    );
    expect(out.map((l) => l.name)).toEqual(["Big City"]);
  });

  it("moves a label to another side rather than off the map", () => {
    const [l] = layoutLabels([{ name: "Edge Town", x: 995, y: 500, score: 1 }], { upp: 1, view });
    expect(l?.anchor).toBe("end"); // placed to the left
  });

  it("never returns overlapping labels", () => {
    const labels = Array.from({ length: 80 }, (_, i) => ({ name: `Place ${i}`, x: 100 + (i % 10) * 40, y: 100 + Math.floor(i / 10) * 18, score: i }));
    const out = layoutLabels(labels, { upp: 1, view, max: 80 });
    const boxes = out.map((l) => {
      const w = textWidthPx(l.name, 12);
      const x0 = l.anchor === "start" ? l.tx : l.anchor === "end" ? l.tx - w : l.tx - w / 2;
      return { x0, x1: x0 + w, y0: l.ty - 10, y1: l.ty + 2 };
    });
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1).toBe(false);
      }
    expect(out.length).toBeGreaterThan(5);
  });
});

describe("placesWithin", () => {
  const ward = (id: number) => JSON.parse(readFileSync(join(process.cwd(), "fixtures", "mapdata", `municward${id}.json`), "utf8")) as { features: GeoFeature[] };

  it("finds Gqeberha and Kariega inside Nelson Mandela Bay, and nothing from elsewhere", () => {
    const fc = ward(1001);
    const geo = toSvgPaths(fc.features, (f) => numProp(f, "PklWardID"));
    const names = placesWithin(fc.features, placesData.places as PlaceRow[], geo.projection!).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["Gqeberha", "Kariega"]));
    expect(names).not.toContain("Cape Town");
    expect(names).not.toContain("Durban");
  });

  it("labels Emthanjeni with its towns, preferring Hanover over its township Oakglen", () => {
    const fc = ward(6612);
    const geo = toSvgPaths(fc.features, (f) => numProp(f, "PklWardID"));
    const names = placesWithin(fc.features, placesData.places as PlaceRow[], geo.projection!).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["De Aar", "Britstown", "Hanover"]));
    expect(names).not.toContain("Oakglen");
  });

  it("finds Kimberley inside Sol Plaatje", () => {
    const fc = ward(6046);
    const geo = toSvgPaths(fc.features, (f) => numProp(f, "PklWardID"));
    const names = placesWithin(fc.features, placesData.places as PlaceRow[], geo.projection!).map((p) => p.name);
    expect(names[0]).toBe("Kimberley");
  });
});
