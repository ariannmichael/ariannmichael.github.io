import { describe, expect, it } from "vitest";
import { CAMERA, followFov, followLookAt, followPosition, orbitPosition } from "./cameraMath";

describe("follow camera", () => {
  const car = { x: 10, y: 0.6, z: 5 };

  it("sits behind (-Z at yaw 0) and above the car", () => {
    const p = followPosition(car, 0, 0, { x: 0, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(10);
    expect(p.z).toBeCloseTo(5 - CAMERA.distance);
    expect(p.y).toBeCloseTo(0.6 + CAMERA.height);
  });

  it("follows the heading: yaw 90 deg faces +X, so the camera is at -X", () => {
    const p = followPosition(car, Math.PI / 2, 0, { x: 0, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(10 - CAMERA.distance);
    expect(p.z).toBeCloseTo(5);
  });

  it("pulls back with speed and looks ahead", () => {
    const slow = followPosition(car, 0, 0, { x: 0, y: 0, z: 0 });
    const fast = followPosition(car, 0, 20, { x: 0, y: 0, z: 0 });
    expect(fast.z).toBeLessThan(slow.z);
    expect(followLookAt(car, 0, 0, { x: 0, y: 0, z: 0 }).z).toBeGreaterThan(car.z);
    expect(followFov(20)).toBeGreaterThan(followFov(0));
    expect(followFov(1000)).toBe(CAMERA.maxFov);
  });

  it("orbits at a fixed radius and height", () => {
    const p = orbitPosition({ x: 0, y: 0, z: 0 }, 1.2, { x: 0, y: 0, z: 0 });
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(CAMERA.orbitRadius);
    expect(p.y).toBe(CAMERA.orbitHeight);
  });
});
