// Load the layout registry first: frame.ts → terrain.ts → layouts form an import cycle that only
// resolves cleanly when the registry (or terrain) is the entry point.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { latLonToDir } from "@/world/planet/frame";
import { naturalHeightXYZ } from "@/world/planet/terrain";
import type { LatLon } from "@/world/planet/types";
import { site } from "./b/site";
import { blockersOnPath, checkLayout, maxGrade } from "./b/checkLayout";
import { OPENSOURCE_LAB, OPENSOURCE_LAB_PADS, opensourceLayout } from "./opensource";

const s = site({ lat: 70, lon: -20 });
const lane = (pts: [number, number][]): LatLon[] => pts.map(([f, r]) => s.at(...OPENSOURCE_LAB.ne(f, r)));

describe("opensource layout (Alien Crater)", () => {
  checkLayout(opensourceLayout);

  it("the lab is drivable: entry gate → corridor → room → corridor → corner → exit gate", () => {
    const pts: [number, number][] = [];
    for (let f = -26; f <= 24; f += 1) for (const r of [-1.4, 0, 1.4]) pts.push([f, r]);
    for (let r = 0; r >= -18; r -= 1) for (const f of [22.6, 24, 25.4]) pts.push([f, r]);
    expect(blockersOnPath(opensourceLayout, lane(pts))).toEqual([]);
    const centre: [number, number][] = [];
    for (let f = -34; f <= 24; f += 1) centre.push([f, 0]);
    for (let r = 0; r >= -22; r -= 1) centre.push([24, r]);
    expect(maxGrade(lane(centre))).toBeLessThan(0.3);
  });

  it("the drive from the spawn down into the crater is drivable", () => {
    const path: LatLon[] = [];
    for (let n = -36; n <= -8; n += 1) path.push(s.at(n, -6));
    expect(maxGrade(path)).toBeLessThan(0.55);
    const wide: LatLon[] = [];
    for (let n = -36; n <= -9; n += 1) for (const e of [-9, -6, -3]) wide.push(s.at(n, e));
    expect(blockersOnPath(opensourceLayout, wide)).toEqual([]);
  });

  it("the room's laser gate (west door) is drivable too", () => {
    const pts: [number, number][] = [];
    for (let r = -2; r >= -18; r -= 1) for (const f of [-1.4, 0, 1.4]) pts.push([f, r]);
    expect(blockersOnPath(opensourceLayout, lane(pts))).toEqual([]);
  });

  it("corridor walls hold: points just outside the corridor shells are blocked", () => {
    for (const [f, r] of [
      [-16, 4.3],
      [-16, -4.3],
      [16, 4.3],
      [22, 4.3],
      [27.3, 3.3],
      [27.6, -8],
      [0, 13],
    ] as [number, number][]) {
      expect(blockersOnPath(opensourceLayout, lane([[f, r]])).length, `${f},${r}`).toBeGreaterThan(0);
    }
  });

  it("lab pads are levelled to the same height", () => {
    const targets = OPENSOURCE_LAB_PADS.map((p) => {
      const d = latLonToDir(p.lat, p.lon);
      return naturalHeightXYZ(d.x, d.y, d.z) + (p.height ?? 0);
    });
    for (const t of targets) expect(t).toBeCloseTo(1, 1);
  });
});
