import { describe, expect, it } from "vitest";
import { getModel, rotatedBounds } from "@/world/models";
import { TILE } from "@/world/layout/types";
import {
  analyzeRoads,
  authored,
  centredAt,
  cityRun,
  localize,
  mixedRow,
  raceRun,
  range,
  roadCells,
  rotateOffset,
  row,
  scatter,
  seeded,
  turn,
} from "./helpers";

describe("district helpers", () => {
  it("range is inclusive in both directions", () => {
    expect(range(1, 3)).toEqual([1, 2, 3]);
    expect(range(3, 1)).toEqual([3, 2, 1]);
    expect(range(2, 2)).toEqual([2]);
  });

  it("road runs pick the rotation for their axis and are drive-through", () => {
    expect(cityRun("x", 4, 0, 2).map((p) => [p.x, p.z, p.rot])).toEqual([
      [0, 4, 0],
      [1, 4, 0],
      [2, 4, 0],
    ]);
    expect(cityRun("z", 4, 0, 2, [1]).map((p) => [p.x, p.z, p.rot])).toEqual([
      [4, 0, 1],
      [4, 2, 1],
    ]);
    expect(raceRun("z", 1, 0, 1).every((p) => p.rot === 0 && p.collider === "none")).toBe(true);
    expect(raceRun("x", 1, 0, 1).every((p) => p.rot === 1)).toBe(true);
  });

  it("row and mixedRow step and cycle", () => {
    expect(row("car-kit/cone", { x: 1, z: 2 }, { x: 0.5, z: 0 }, 3).map((p) => p.x)).toEqual([1, 1.5, 2]);
    expect(mixedRow(["a/b", "c/d"], { x: 0, z: 0 }, { x: 1, z: 0 }, 3).map((p) => p.model)).toEqual([
      "a/b",
      "c/d",
      "a/b",
    ]);
  });

  it("localize and authored convert town to district coordinates", () => {
    expect(localize({ x: 2, z: -1 }, [{ x: 5, z: 5 }])).toEqual([{ x: 3, z: 6 }]);
    const d = authored({ x: 1, z: 1 }, { placements: [], markers: [{ id: "cv", kind: "cv", x: 1, z: 1 }], spawn: { x: 3, z: 4, rot: 2 } });
    expect(d.markers[0]).toMatchObject({ x: 0, z: 0 });
    expect(d.spawn).toEqual({ x: 2, z: 3, rot: 2 });
  });

  it("turn and rotateOffset agree with a counter-clockwise quarter turn", () => {
    expect(turn("E", 1)).toBe("N");
    expect(turn("S", 1)).toBe("E");
    expect(turn("W", 3)).toBe("N");
    expect(rotateOffset(1, 0, 1)).toEqual([0, -1]); // +X turns to -Z (north)
    expect(rotateOffset(1, -1, 3)).toEqual([1, 1]);
  });

  it("centredAt puts the footprint centre on the requested tile", () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const p = centredAt("racing-kit/treeLarge", 3, -2, rot);
      const b = rotatedBounds("racing-kit/treeLarge", rot);
      expect(p.x + (b.min[0] + b.max[0]) / 2 / TILE).toBeCloseTo(3, 2);
      expect(p.z + (b.min[2] + b.max[2]) / 2 / TILE).toBeCloseTo(-2, 2);
    }
    expect(getModel("racing-kit/treeLarge")).toBeTruthy();
  });

  it("road cells rotate with their piece", () => {
    const [bend] = roadCells({ model: "city-roads/road-bend", x: 0, z: 0, rot: 2 });
    expect([...bend.open].sort()).toEqual(["E", "N"]);
    const corner = roadCells({ model: "racing-kit/roadCornerLarge", x: 0, z: 0, rot: 3 });
    expect(corner.map((c) => `${c.x},${c.z}`).sort()).toEqual(["0,0", "0,1", "1,0", "1,1"]);
    expect(corner.find((c) => c.x === 0 && c.z === 0)?.open).toEqual(new Set(["W"]));
    expect(corner.find((c) => c.x === 1 && c.z === 1)?.open).toEqual(new Set(["S"]));
  });

  it("analyzeRoads finds joins, gaps and overlaps", () => {
    const ok = analyzeRoads([
      { model: "city-roads/road-end", x: 0, z: 0, rot: 0 },
      { model: "city-roads/road-straight", x: 1, z: 0, rot: 0 },
      { model: "city-roads/road-end", x: 2, z: 0, rot: 2 },
    ]);
    expect(ok).toMatchObject({ overlaps: [], danglingEnds: [], components: 1 });

    // A straight rotated the wrong way leaves both ends dangling
    const bad = analyzeRoads([
      { model: "city-roads/road-end", x: 0, z: 0, rot: 0 },
      { model: "city-roads/road-straight", x: 1, z: 0, rot: 1 },
    ]);
    expect(bad.danglingEnds.length).toBeGreaterThan(0);
    expect(bad.components).toBe(2);

    const dup = analyzeRoads([
      { model: "city-roads/road-straight", x: 0, z: 0 },
      { model: "city-roads/road-straight", x: 0, z: 0 },
    ]);
    expect(dup.overlaps).toEqual(["0,0"]);
  });

  it("seeded scatter is deterministic and stays in its area", () => {
    expect(seeded(7)()).toBe(seeded(7)());
    const a = scatter(["a/b"], { x0: 0, x1: 2, z0: 5, z1: 6 }, 20, 3);
    expect(a).toEqual(scatter(["a/b"], { x0: 0, x1: 2, z0: 5, z1: 6 }, 20, 3));
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(2);
      expect(p.z).toBeGreaterThanOrEqual(5);
      expect(p.z).toBeLessThanOrEqual(6);
    }
  });
});
