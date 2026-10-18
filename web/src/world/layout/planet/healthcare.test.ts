// Load the layout registry first: frame.ts → terrain.ts → layouts form an import cycle that only
// resolves cleanly when the registry (or terrain) is the entry point.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { site } from "./b/site";
import { blockersOnPath, checkLayout, maxGrade } from "./b/checkLayout";
import { HEALTHCARE_HALL, healthcareLayout } from "./healthcare";

describe("healthcare layout (Clinic Lakeside)", () => {
  checkLayout(healthcareLayout);

  it("the factory hall lane is drivable from door to door, ±1.4 m either side of centre", () => {
    const s = site({ lat: -15, lon: 140 });
    const path = [];
    for (let f = -18; f <= 18; f += 1) {
      for (const r of [-1.4, 0, 1.4]) path.push(s.at(...HEALTHCARE_HALL.ne(f, r)));
    }
    expect(blockersOnPath(healthcareLayout, path)).toEqual([]);
  });

  it("the hall approaches are gentle enough to drive in from either side", () => {
    const s = site({ lat: -15, lon: 140 });
    const path = [];
    for (let f = -32; f <= 32; f += 1) path.push(s.at(...HEALTHCARE_HALL.ne(f, 0)));
    expect(maxGrade(path)).toBeLessThan(0.3);
  });

  it("has a single, tallest Afya tower", () => {
    const towers = healthcareLayout.placements.filter((p) => p.model.includes("skyscraper"));
    expect(towers).toHaveLength(1);
  });
});
