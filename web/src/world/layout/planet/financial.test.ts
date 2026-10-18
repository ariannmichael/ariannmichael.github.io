// Load the layout registry first: frame.ts → terrain.ts → layouts form an import cycle that only
// resolves cleanly when the registry (or terrain) is the entry point.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { latLonToDir } from "@/world/planet/frame";
import { naturalHeightXYZ } from "@/world/planet/terrain";
import type { LatLon } from "@/world/planet/types";
import { site } from "./b/site";
import { blockersOnPath, checkLayout, maxGrade } from "./b/checkLayout";
import { FINANCIAL_HALL, FINANCIAL_RAMP, FINANCIAL_ROAD, financialLayout } from "./financial";

const s = site({ lat: 20, lon: -75 });
const natural = (p: LatLon) => {
  const d = latLonToDir(p.lat, p.lon);
  return naturalHeightXYZ(d.x, d.y, d.z);
};

describe("financial layout (Desert Mesa)", () => {
  checkLayout(financialLayout);

  it("the drive-thru lane is clear from entry to exit", () => {
    const path = [];
    for (let f = -12; f <= 10; f += 1) {
      for (const r of [-1.4, 0, 1.4]) path.push(s.at(...FINANCIAL_HALL.ne(f, r)));
    }
    expect(blockersOnPath(financialLayout, path)).toEqual([]);
  });

  it("the road from the spawn up to the tower plaza is clear", () => {
    const path = [];
    for (let t = 0; t <= 66; t += 1) path.push(s.at(...FINANCIAL_ROAD.ne(t, 0)));
    expect(blockersOnPath(financialLayout, path)).toEqual([]);
    expect(maxGrade(path)).toBeLessThan(0.35);
  });

  it("ramp pads climb steadily from the plain onto the mesa", () => {
    const targets = FINANCIAL_RAMP.map(({ t, height }) => natural(s.at(...FINANCIAL_ROAD.ne(t, 0))) + height);
    const mesa = financialLayout.pads.find((p) => p.radius === 13)!;
    targets.push(natural(mesa) + (mesa.height ?? 0));
    for (let i = 1; i < targets.length; i++) {
      const rise = targets[i] - targets[i - 1];
      expect(rise).toBeGreaterThan(0.5);
      expect(rise).toBeLessThan(1.8);
    }
  });
});
