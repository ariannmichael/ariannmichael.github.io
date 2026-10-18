import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { PLANET_GRAVITY } from "./config";
import { applyPlanetGravityStep, gravityForce, gravityImpulse, type GravityBody, type Vec3Like } from "./gravity";

describe("planet gravity", () => {
  it("points at the centre with magnitude g·m", () => {
    for (const p of [new Vector3(0, 160, 0), new Vector3(100, -50, 30), new Vector3(-3, 2, 151)]) {
      const f = gravityForce(p, 2, new Vector3());
      expect(f.clone().normalize().dot(p.clone().normalize())).toBeCloseTo(-1, 9);
      expect(f.length()).toBeCloseTo(PLANET_GRAVITY * 2, 9);
    }
  });

  it("is zero at the exact centre and writes into `out`", () => {
    const out = new Vector3(9, 9, 9);
    expect(gravityForce(new Vector3(), 5, out)).toBe(out);
    expect(out.length()).toBe(0);
  });

  it("impulse = force × dt", () => {
    const p = new Vector3(10, 140, -20);
    const f = gravityForce(p, 3, new Vector3());
    const j = gravityImpulse(p, 3, 1 / 60, new Vector3());
    expect(j.distanceTo(f.multiplyScalar(1 / 60))).toBeLessThan(1e-12);
  });

  it("only pushes awake dynamic bodies, scaled by gravityScale", () => {
    const make = (dynamic: boolean, sleeping: boolean, scale: number) => {
      const applied: Vec3Like[] = [];
      const body: GravityBody = {
        isDynamic: () => dynamic,
        isSleeping: () => sleeping,
        isEnabled: () => true,
        gravityScale: () => scale,
        mass: () => 10,
        translation: () => ({ x: 0, y: 155, z: 0 }),
        applyImpulse: (i) => applied.push({ ...i }),
      };
      return { body, applied };
    };
    const bodies = [make(true, false, 1), make(false, false, 1), make(true, true, 1), make(true, false, 0), make(true, false, 2)];
    applyPlanetGravityStep({ timestep: 0.5, forEachRigidBody: (f) => bodies.forEach((b) => f(b.body)) });
    expect(bodies[0].applied).toEqual([{ x: -0, y: -PLANET_GRAVITY * 10 * 0.5, z: -0 }]);
    expect(bodies[1].applied).toHaveLength(0);
    expect(bodies[2].applied).toHaveLength(0);
    expect(bodies[3].applied).toHaveLength(0);
    expect(bodies[4].applied[0].y).toBeCloseTo(-PLANET_GRAVITY * 20 * 0.5);
  });
});
