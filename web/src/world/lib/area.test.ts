import { describe, expect, it } from "vitest";
import { TILE, type DistrictLayout } from "@/world/layout/types";
import { districtAt, districtRect, spawnPose, townRect } from "./area";

const layout = (over: Partial<DistrictLayout> = {}): DistrictLayout => ({
  id: "home",
  origin: { x: 0, z: 0 },
  spawn: { x: 0, z: 0, rot: 0 },
  placements: [{ model: "a/b", x: 2, z: -1 }],
  markers: [{ id: "about", kind: "about", x: -1, z: 3 }],
  ...over,
});

describe("areas", () => {
  it("district rect covers placements, markers and spawn, padded by half a tile", () => {
    expect(districtRect(layout())).toEqual({
      minX: -1.5 * TILE,
      maxX: 2.5 * TILE,
      minZ: -1.5 * TILE,
      maxZ: 3.5 * TILE,
    });
  });

  it("town rect is the union of districts, with margin", () => {
    const a = layout();
    const b = layout({ id: "raceway", origin: { x: 10, z: 0 } });
    const r = townRect([a, b], 1);
    expect(r.minX).toBe(-2.5 * TILE);
    expect(r.maxX).toBe(13.5 * TILE);
    expect(townRect([], 0)).toEqual({ minX: -4, maxX: 4, minZ: -4, maxZ: 4 });
  });

  it("districtAt finds the containing district", () => {
    const rects = [
      { id: "home" as const, rect: districtRect(layout()) },
      { id: "raceway" as const, rect: districtRect(layout({ id: "raceway", origin: { x: 10, z: 0 } })) },
    ];
    expect(districtAt(rects, 0, 0)).toBe("home");
    expect(districtAt(rects, 10 * TILE, 0)).toBe("raceway");
    expect(districtAt(rects, 6 * TILE, 0)).toBeNull();
  });

  it("spawn pose uses origin + spawn tile and quarter-turn yaw, with fallbacks", () => {
    const l = layout({ origin: { x: 3, z: 1 }, spawn: { x: 1, z: -2, rot: 2 } });
    const pose = spawnPose([l], "home");
    expect(pose.position).toEqual([4 * TILE, 0, -1 * TILE]);
    expect(pose.yaw).toBeCloseTo(Math.PI);
    // Unknown district -> first layout
    expect(spawnPose([l], "raceway").position).toEqual(pose.position);
    expect(spawnPose([], "home")).toEqual({ position: [0, 0, 0], yaw: 0 });
  });
});
