import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  CAMERA,
  clampAboveTerrain,
  followFov,
  followLookAt,
  followPosition,
  liftForLineOfSight,
  orbitPosition,
  projectToTangent,
} from "./cameraMath";

const R = 150;
const flat = () => R;

describe("follow camera on the sphere", () => {
  // Car on the equator at +Z, heading north (+Y)
  const car = new Vector3(0, 0, R);
  const up = car.clone().normalize();
  const heading = new Vector3(0, 1, 0);

  it("sits behind the heading and above along local up", () => {
    const p = followPosition(car, up, heading, 0, new Vector3());
    expect(p.y).toBeCloseTo(-CAMERA.distance);
    expect(p.z).toBeCloseTo(R + CAMERA.height);
    expect(p.x).toBeCloseTo(0);
  });

  it("works the same anywhere on the planet (up = radial)", () => {
    const c = new Vector3(1, 1, 1).normalize().multiplyScalar(R);
    const u = c.clone().normalize();
    const h = projectToTangent(new Vector3(0, 1, 0), u, new Vector3(1, 0, 0));
    const p = followPosition(c, u, h, 0, new Vector3());
    const rel = p.clone().sub(c);
    expect(rel.dot(u)).toBeCloseTo(CAMERA.height);
    expect(rel.dot(h)).toBeCloseTo(-CAMERA.distance);
  });

  it("pulls back with speed and looks ahead", () => {
    const slow = followPosition(car, up, heading, 0, new Vector3());
    const fast = followPosition(car, up, heading, 20, new Vector3());
    expect(fast.y).toBeLessThan(slow.y);
    expect(followLookAt(car, up, heading, 0, new Vector3()).y).toBeGreaterThan(0);
    expect(followFov(20)).toBeGreaterThan(followFov(0));
    expect(followFov(1000)).toBe(CAMERA.maxFov);
  });

  it("projectToTangent keeps a heading on the tangent plane and falls back when degenerate", () => {
    const h = projectToTangent(new Vector3(0, 1, 1), up, heading);
    expect(h.dot(up)).toBeCloseTo(0);
    expect(h.length()).toBeCloseTo(1);
    const d = projectToTangent(up.clone(), up, heading);
    expect(d.y).toBeCloseTo(1);
  });
});

describe("terrain awareness", () => {
  it("never lets the camera go below the terrain plus clearance", () => {
    const p = new Vector3(0, 0, R - 3);
    const lift = clampAboveTerrain(p, 1.2, flat);
    expect(p.length()).toBeCloseTo(R + 1.2);
    expect(lift).toBeCloseTo(4.2);
    const q = new Vector3(0, 0, R + 5);
    expect(clampAboveTerrain(q, 1.2, flat)).toBe(0);
    expect(q.z).toBe(R + 5);
  });

  it("lifts the camera when a hill blocks the line of sight", () => {
    // A 6 m bump halfway between the car (at +Z) and the camera behind it (towards -Y)
    const hill = (dir: Vector3) => R + (Math.abs(Math.atan2(-dir.y, dir.z) - 5 / R) < 2 / R ? 6 : 0);
    const target = new Vector3(0, 0, R + 1.4);
    const cam = new Vector3(0, -10, R + 3.6);
    const lift = liftForLineOfSight(target, cam, 0.5, 16, hill);
    expect(lift).toBeGreaterThan(0);
    // After the lift, every sample along the segment clears the hill
    for (let i = 1; i <= 16; i++) {
      const pt = target.clone().lerp(cam, i / 16);
      expect(pt.length()).toBeGreaterThanOrEqual(hill(pt.clone().normalize()) + 0.49);
    }
    const clear = new Vector3(0, -10, R + 3.6);
    expect(liftForLineOfSight(target, clear, 0.5, 16, flat)).toBe(0);
  });
});

describe("intro orbit", () => {
  it("orbits the spawn in its tangent plane at a fixed radius and height", () => {
    const center = new Vector3(0, R, 0);
    const up = new Vector3(0, 1, 0);
    for (const a of [0, 1.2, 3]) {
      const p = orbitPosition(center, up, a, new Vector3());
      const rel = p.clone().sub(center);
      expect(rel.dot(up)).toBeCloseTo(CAMERA.orbitHeight);
      expect(Math.hypot(rel.x, rel.z)).toBeCloseTo(CAMERA.orbitRadius);
    }
  });
});
