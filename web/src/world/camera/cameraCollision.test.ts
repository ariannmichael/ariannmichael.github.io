import { Vector3 } from "three";
import { afterEach, describe, expect, it } from "vitest";
import { CAMERA_QUERY_FLAGS, hasCameraWorld, probeRay, registerCameraWorld, sweepArm, type CameraQueryWorld, type CameraRapier } from "./cameraCollision";

type V = { x: number; y: number; z: number };

/** Fake rapier: a single wall plane at y = wallY (the arm points along -y). */
function fakeWorld(wallY: number) {
  const calls: { kind: string; flags?: number; maxToi: number; origin: V }[] = [];
  const world = {
    castShape: (pos: V, _rot: unknown, vel: V, _shape: unknown, _target: number, maxToi: number, _stop: boolean, flags?: number) => {
      calls.push({ kind: "shape", flags, maxToi, origin: { ...pos } });
      if (vel.y >= 0) return null;
      const toi = (pos.y - wallY - 0.3) / -vel.y;
      return toi >= 0 && toi <= maxToi ? { time_of_impact: toi } : null;
    },
    castRay: (ray: { origin: V; dir: V }, maxToi: number, _solid: boolean, flags?: number) => {
      calls.push({ kind: "ray", flags, maxToi, origin: { ...ray.origin } });
      return ray.dir.z > 0 && maxToi >= 2 ? { timeOfImpact: 2 } : null;
    },
  } as unknown as CameraQueryWorld;
  const rapier: CameraRapier = {
    Ray: class {
      constructor(
        public origin: V,
        public dir: V,
      ) {}
    } as unknown as CameraRapier["Ray"],
    Ball: class {
      constructor(public radius: number) {}
    } as unknown as CameraRapier["Ball"],
  };
  return { world, rapier, calls };
}

let unregister: (() => void) | undefined;
afterEach(() => {
  unregister?.();
  unregister = undefined;
});

describe("camera collision probes", () => {
  it("report clear with no world registered", () => {
    expect(hasCameraWorld()).toBe(false);
    expect(sweepArm(new Vector3(), new Vector3(0, -1, 0), 10)).toBeNull();
    expect(probeRay(new Vector3(), new Vector3(0, 0, 1), 5)).toBeNull();
  });

  it("sweep the arm and probe the ceiling, skipping dynamic bodies and sensors", () => {
    const f = fakeWorld(-6);
    unregister = registerCameraWorld(f.world, f.rapier, 0.3);
    expect(hasCameraWorld()).toBe(true);
    const from = new Vector3(0, 0, 2.4);
    expect(sweepArm(from, new Vector3(0, -1, 0), 10)).toBeCloseTo(5.7);
    expect(sweepArm(from, new Vector3(0, -1, 0), 3)).toBeNull();
    expect(probeRay(from, new Vector3(0, 0, 1), 5)).toBe(2);
    for (const c of f.calls) {
      expect(c.flags).toBe(CAMERA_QUERY_FLAGS);
      expect(c.origin).toEqual({ x: 0, y: 0, z: 2.4 });
    }
    // EXCLUDE_DYNAMIC | EXCLUDE_SENSORS
    expect(CAMERA_QUERY_FLAGS & 4).toBe(4);
    expect(CAMERA_QUERY_FLAGS & 8).toBe(8);
    expect(CAMERA_QUERY_FLAGS & 1).toBe(0);
  });

  it("an older registration can't unregister a newer one", () => {
    const a = fakeWorld(-6);
    const b = fakeWorld(-6);
    const offA = registerCameraWorld(a.world, a.rapier, 0.3);
    unregister = registerCameraWorld(b.world, b.rapier, 0.3);
    offA();
    expect(hasCameraWorld()).toBe(true);
  });
});
