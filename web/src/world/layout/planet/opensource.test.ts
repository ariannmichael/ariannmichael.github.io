// Load the layout registry first: frame.ts → terrain.ts → layouts form an import cycle that only
// resolves cleanly when the registry (or terrain) is the entry point.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { latLonToDir } from "@/world/planet/frame";
import { naturalHeightXYZ } from "@/world/planet/terrain";
import type { LatLon } from "@/world/planet/types";
import { site } from "./b/site";
import { blockersOnPath, checkLayout, laneBlockers, maxGrade, polyline } from "./b/checkLayout";
import {
  DOOR_LEVEL,
  OPENSOURCE_BOWL,
  OPENSOURCE_CENTER,
  OPENSOURCE_LAB,
  OPENSOURCE_LAB_PADS,
  OPENSOURCE_SPAWN,
  ROOM_LEVEL,
  opensourceLayout,
} from "./opensource";

const s = site(OPENSOURCE_CENTER);
const lab = (f: number, r: number) => OPENSOURCE_LAB.ne(f, r);
const lane = (pts: [number, number][]): LatLon[] => pts.map(([f, r]) => s.at(...lab(f, r)));

describe("opensource layout (Alien Crater)", () => {
  checkLayout(opensourceLayout);

  it("the lab is drivable: entry gate → corridor → room → corner → exit gate", () => {
    const pts: [number, number][] = [];
    for (let f = -28; f <= 16; f += 1) for (const r of [-1.4, 0, 1.4]) pts.push([f, r]);
    for (let r = 0; r >= -12; r -= 1) for (const f of [14.6, 16, 17.4]) pts.push([f, r]);
    expect(blockersOnPath(opensourceLayout, lane(pts))).toEqual([]);
    const centre: [number, number][] = [];
    for (let f = -30; f <= 16; f += 1) centre.push([f, 0]);
    for (let r = 0; r >= -4; r -= 1) centre.push([16, r]);
    expect(maxGrade(lane(centre))).toBeLessThan(0.3);
    // Out of the exit gate the ground climbs 4 m to the spawn ridge along EXIT_RAMP (about 0.27 average)
    const exit: [number, number][] = [];
    for (let r = -4; r >= -26; r -= 1) exit.push([16, r]);
    expect(maxGrade(lane(exit))).toBeLessThan(0.36);
  });

  it("the drive from the spawn down into the crater is drivable", () => {
    // Down the north terraces onto the crater floor (the basin walls are too steep to drive straight)
    const path = polyline(s, [OPENSOURCE_SPAWN, [9, -10], [3, -11], [-4, -12], [-8.7, -12.9], OPENSOURCE_BOWL]);
    expect(maxGrade(path)).toBeLessThan(0.55);
    expect(blockersOnPath(opensourceLayout, path)).toEqual([]);
  });

  it("the lab's entry gate and laser gate are reachable from the crater", () => {
    // Crater → south terraces → through the ridge pass → down the causeway to the entry gate
    const south = polyline(s, [[-14, -15], [-21, -8], [-25, -3], [-29, 1], lab(-30, 0), lab(-20, 0)]);
    expect(blockersOnPath(opensourceLayout, south)).toEqual([]);
    expect(maxGrade(south)).toBeLessThan(0.45);
    // Crater floor → up the NW face → the west landing → laser door apron → through the laser gate
    const west = polyline(s, [[-15, -16], [-13, -12], [-10.5, -8], lab(0, -18), lab(0, 0)]);
    expect(blockersOnPath(opensourceLayout, west)).toEqual([]);
    expect(maxGrade(west)).toBeLessThan(0.45);
  });

  it("corridor walls hold: points just outside the corridor shells are blocked", () => {
    for (const [f, r] of [
      [-16, 4.3],
      [-16, -4.3],
      [14, 4.3],
      [19.6, 0],
      [18.6, 2.6],
      [0, 13],
    ] as [number, number][]) {
      expect(blockersOnPath(opensourceLayout, lane([[f, r]])).length, `${f},${r}`).toBeGreaterThan(0);
    }
  });

  it("lab pads are levelled: the room plane at ROOM_LEVEL, the corridor pads at its door height", () => {
    const target = (p: LatLon & { height?: number }) => {
      const d = latLonToDir(p.lat, p.lon);
      return naturalHeightXYZ(d.x, d.y, d.z) + (p.height ?? 0);
    };
    for (const p of OPENSOURCE_LAB_PADS) expect(target(p)).toBeCloseTo(p.planar ? ROOM_LEVEL : DOOR_LEVEL, 1);
  });

  it("keeps both road lanes (NW 321°, NE 39°) clear from the spawn", () => {
    for (const bearing of [321, 39]) expect(laneBlockers(opensourceLayout, opensourceLayout.spawn, bearing), `${bearing}`).toEqual([]);
  });

  it("has the crater bowl, the rocket and the OpenMined hangar", () => {
    const models = opensourceLayout.placements.map((p) => p.model);
    for (const m of ["space-kit/rocket_baseA", "space-kit/rocket_fuelB", "space-kit/rocket_topA", "space-kit/hangar_roundGlass"]) {
      expect(models, m).toContain(m);
    }
    const bowl = opensourceLayout.pads.find((p) => p.radius === 7 && (p.height ?? 0) < 0);
    expect(bowl).toBeDefined();  });
});
