// Load the layout registry first: frame.ts → terrain.ts → layouts form an import cycle that only
// resolves cleanly when the registry (or terrain) is the entry point.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { latLonToDir } from "@/world/planet/frame";
import { naturalHeightXYZ } from "@/world/planet/terrain";
import type { LatLon } from "@/world/planet/types";
import { site } from "./b/site";
import { blockersOnPath, checkLayout, laneBlockers, maxGrade, polyline, topOf } from "./b/checkLayout";
import { FINANCIAL_CENTER, FINANCIAL_HALL, FINANCIAL_RAMP, FINANCIAL_ROAD, FINANCIAL_SPAWN, financialLayout } from "./financial";

const s = site(FINANCIAL_CENTER);
const natural = (p: LatLon) => {
  const d = latLonToDir(p.lat, p.lon);
  return naturalHeightXYZ(d.x, d.y, d.z);
};
const target = (p: LatLon & { height?: number }) => natural(p) + (p.height ?? 0);

describe("financial layout (Desert Mesa)", () => {
  checkLayout(financialLayout);

  it("the drive-thru lane is clear from entry to exit", () => {
    const path = [];
    for (let f = -12; f <= 10; f += 1) {
      for (const r of [-1.4, 0, 1.4]) path.push(s.at(...FINANCIAL_HALL.ne(f, r)));
    }
    expect(blockersOnPath(financialLayout, path)).toEqual([]);
  });

  it("the road from the spawn up to the tower plaza is clear and drivable", () => {
    const path = [];
    for (let t = 0; t <= 44; t += 1) path.push(s.at(...FINANCIAL_ROAD.ne(t, 0)));
    expect(blockersOnPath(financialLayout, path)).toEqual([]);
    expect(maxGrade(path)).toBeLessThan(0.35);
  });

  it("ramp pads climb steadily from the drive-thru onto the mesa", () => {
    const [hall, mesa] = financialLayout.pads.filter((p) => p.planar);
    const ramp = FINANCIAL_RAMP.map(({ t, height }) => ({ ...s.at(...FINANCIAL_ROAD.ne(t, 0)), height }));
    const targets = [hall, ...ramp, mesa].map(target);
    for (let i = 1; i < targets.length; i++) {
      const rise = targets[i] - targets[i - 1];
      expect(rise).toBeGreaterThan(0.2);
      expect(rise).toBeLessThan(1.8);
    }
    expect(targets[targets.length - 1] - targets[0]).toBeGreaterThan(2.5);
  });

  it("the mesa top stands above the canyon floor around it", () => {
    const mesa = financialLayout.pads.find((p) => p.planar && p.radius === 10)!;
    const [n, e] = s.toNE(mesa);
    // The canyon floor north, north-east and south of the mesa, outside its blend ring
    for (const [dn, de] of [
      [14, 0],
      [12, 6],
      [-14, 0],
    ]) {
      expect(natural(s.at(n + dn, e + de)), `${dn},${de}`).toBeLessThan(target(mesa) - 3);
    }
  });

  it("keeps both road lanes (SW 219°, SE 141°) clear from the spawn", () => {
    for (const bearing of [219, 141]) expect(laneBlockers(financialLayout, financialLayout.spawn, bearing), `${bearing}`).toEqual([]);
  });

  it("the finance tower is the tallest thing in town, with giant food along the road", () => {
    const tower = financialLayout.placements.find((p) => p.model.includes("skyscraper"))!;
    for (const p of financialLayout.placements) if (p !== tower) expect(topOf(p), p.model).toBeLessThan(topOf(tower));
    // (a handful of giant food pieces carry the theme; the 2026-10-18 declutter cut the rest)
    expect(financialLayout.placements.filter((p) => p.model.startsWith("food-kit/")).length).toBeGreaterThanOrEqual(8);
  });

  it("the industrial yard and the canyon are reachable from the spawn", () => {
    for (const route of [
      [FINANCIAL_SPAWN, [-22, 8], [-8, 20]],
      [FINANCIAL_SPAWN, [-14, -20], [10, -22]],
    ] as [number, number][][]) {
      expect(blockersOnPath(financialLayout, polyline(s, route)), JSON.stringify(route)).toEqual([]);
    }
  });
});
