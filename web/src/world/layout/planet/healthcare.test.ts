// Load the layout registry first: frame.ts → terrain.ts → layouts form an import cycle that only
// resolves cleanly when the registry (or terrain) is the entry point.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { site } from "./b/site";
import { blockersOnPath, checkLayout, laneBlockers, maxGrade, polyline, topOf } from "./b/checkLayout";
import { HEALTHCARE_CENTER, HEALTHCARE_HALL, HEALTHCARE_SPAWN, healthcareLayout } from "./healthcare";

const s = site(HEALTHCARE_CENTER);
const hallAt = (f: number, r: number) => HEALTHCARE_HALL.ne(f, r);

describe("healthcare layout (Clinic Lakeside)", () => {
  checkLayout(healthcareLayout);

  it("the factory hall lane is drivable from door to door, ±1.4 m either side of centre", () => {
    const path = [];
    for (let f = -14; f <= 14; f += 1) {
      for (const r of [-1.4, 0, 1.4]) path.push(s.at(...hallAt(f, r)));
    }
    expect(blockersOnPath(healthcareLayout, path)).toEqual([]);
  });

  it("the hall approaches are gentle enough to drive in from either side", () => {
    const path = [];
    for (let f = -18; f <= 18; f += 1) path.push(s.at(...hallAt(f, 0)));
    expect(maxGrade(path)).toBeLessThan(0.3);
  });

  it("every marker and the hall are reachable from the spawn", () => {
    const routes: [number, number][][] = [
      // Plaza: straight ahead to the Afya tower marker
      [HEALTHCARE_SPAWN, [0, -2]],
      // Med school, past the ambulance
      [HEALTHCARE_SPAWN, [-10, -8], [-4, -16]],
      // Into the hall's south door, through it, out to DrChrono's clinic
      [HEALTHCARE_SPAWN, [-17, 12], hallAt(-16, 0), hallAt(14, 0), [16, 22]],
    ];
    for (const route of routes) {
      const path = polyline(s, route);
      expect(blockersOnPath(healthcareLayout, path), JSON.stringify(route)).toEqual([]);
      expect(maxGrade(path), JSON.stringify(route)).toBeLessThan(0.35);
    }
  });

  it("keeps both road lanes (SW 219°, SE 141°) clear from the spawn", () => {
    for (const bearing of [219, 141]) expect(laneBlockers(healthcareLayout, healthcareLayout.spawn, bearing), `${bearing}`).toEqual([]);
  });

  it("has a single Afya tower, the tallest building in the biome", () => {
    const towers = healthcareLayout.placements.filter((p) => p.model.includes("skyscraper"));
    expect(towers).toHaveLength(1);
    const others = healthcareLayout.placements.filter((p) => p !== towers[0] && p.model.startsWith("city-commercial/building"));
    for (const p of others) expect(topOf(p), p.model).toBeLessThan(topOf(towers[0]));
  });
});
