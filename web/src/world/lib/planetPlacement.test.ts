import { describe, expect, it } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import { headingAt, latLonToDir, surfaceFrame, surfaceRadius } from "@/world/planet/frame";
import type { PlanetPlacement } from "@/world/planet/types";
import { markerSensorBox, planetColliderBox, planetPlacementMatrix, placementPose } from "./planetPlacement";

const at = (p: Partial<PlanetPlacement> = {}): PlanetPlacement => ({ model: "kit/thing", lat: 20, lon: 30, ...p });
const axis = (m: Matrix4, x: number, y: number, z: number) => new Vector3(x, y, z).transformDirection(m);

describe("planet placement matrix", () => {
  it("stands on the terrain with model +Y along the radial direction", () => {
    for (const [lat, lon] of [
      [10, 0],
      [-45, 120],
      [89, -10],
      [0, 180],
    ]) {
      const m = planetPlacementMatrix(at({ lat, lon }), 1);
      const dir = latLonToDir(lat, lon);
      expect(axis(m, 0, 1, 0).dot(dir)).toBeCloseTo(1);
      const pos = new Vector3().setFromMatrixPosition(m);
      expect(pos.length()).toBeCloseTo(surfaceRadius(dir));
      expect(pos.clone().normalize().dot(dir)).toBeCloseTo(1);
    }
  });

  it("y lifts along up and scale multiplies kit scale", () => {
    const m = planetPlacementMatrix(at({ y: 3, scale: 2 }), 1.5);
    const pos = new Vector3().setFromMatrixPosition(m);
    expect(pos.length()).toBeCloseTo(surfaceRadius(latLonToDir(20, 30)) + 3);
    expect(new Vector3().setFromMatrixScale(m).x).toBeCloseTo(3);
  });

  it("yaw rotates the model around local up, counter-clockwise from above (0 = north)", () => {
    const frame = surfaceFrame(latLonToDir(20, 30));
    for (const yaw of [0, 45, 90, 180, -90]) {
      const m = planetPlacementMatrix(at({ yaw }), 1);
      const front = axis(m, 0, 0, 1);
      expect(front.dot(headingAt(frame, yaw))).toBeCloseTo(1);
      expect(front.dot(frame.up)).toBeCloseTo(0);
      // Up never changes with yaw
      expect(axis(m, 0, 1, 0).dot(frame.up)).toBeCloseTo(1);
    }
    // yaw 90 turns the front from north to west
    expect(axis(planetPlacementMatrix(at({ yaw: 90 }), 1), 0, 0, 1).dot(frame.east)).toBeCloseTo(-1);
  });

  it("caches poses per placement object", () => {
    const p = at();
    expect(placementPose(p)).toBe(placementPose(p));
  });
});

describe("planet collider box", () => {
  const bounds = { min: [-2, 0, -1] as [number, number, number], max: [2, 4, 3] as [number, number, number] };

  it("keeps the placement orientation and lifts the centre along up", () => {
    const p = at({ yaw: 30 });
    const box = planetColliderBox(p, bounds);
    const pose = placementPose(p);
    expect(new Quaternion(...box.quaternion).angleTo(pose.quaternion)).toBeCloseTo(0);
    expect(box.halfExtents).toEqual([2, 2, 2]);
    // Local centre (0, 2, 1) -> world: 2 m up and 1 m along the heading
    const frame = surfaceFrame(latLonToDir(20, 30));
    const expected = pose.position
      .clone()
      .addScaledVector(frame.up, 2)
      .addScaledVector(headingAt(frame, 30), 1);
    expect(new Vector3(...box.center).distanceTo(expected)).toBeLessThan(1e-6);
  });

  it("scales the box with placement.scale (bounds already include the kit scale)", () => {
    const box = planetColliderBox(at({ scale: 0.5 }), bounds);
    expect(box.halfExtents).toEqual([1, 1, 1]);
  });
});

describe("marker sensor", () => {
  it("sits on the ground, oriented to local up, half its height above the surface", () => {
    const m = { id: "about", kind: "about" as const, lat: -30, lon: 100 };
    const box = markerSensorBox(m, 6, 4);
    const dir = latLonToDir(-30, 100);
    const c = new Vector3(...box.center);
    expect(c.length()).toBeCloseTo(surfaceRadius(dir) + 2);
    expect(c.clone().normalize().dot(dir)).toBeCloseTo(1);
    const up = new Vector3(0, 1, 0).applyQuaternion(new Quaternion(...box.quaternion));
    expect(up.dot(dir)).toBeCloseTo(1);
    expect(box.halfExtents).toEqual([3, 2, 3]);
  });
});
