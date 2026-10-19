// Planet gravity math (pure). Gravity points at the planet centre (world origin), or along a planar
// pad's normal over one (planet/up.ts), with constant magnitude PLANET_GRAVITY: the planet is tiny, so a 1/r² falloff would only make jumps floaty.

import type { Vector3 } from "three";
import { PLANET_GRAVITY } from "./config";
import { groundUpXYZ } from "./up";

/** Anything with x/y/z: three's Vector3 and Rapier's Vector both qualify. */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Force (N) on a body of `mass` (kg) at `position`: −up × PLANET_GRAVITY × mass, where up is radial
 * except over planar pads (planet/up.ts). Zero at the exact centre. Writes into and returns `out`.
 */
export function gravityForce<T extends Vec3Like = Vector3>(position: Vec3Like, mass: number, out: T): T {
  if (Math.hypot(position.x, position.y, position.z) < 1e-9) {
    out.x = out.y = out.z = 0;
    return out;
  }
  groundUpXYZ(position.x, position.y, position.z, out);
  const k = -PLANET_GRAVITY * mass;
  out.x *= k;
  out.y *= k;
  out.z *= k;
  return out;
}

/** Impulse (N·s) for one physics step of `dt` seconds: gravityForce × dt. */
export function gravityImpulse<T extends Vec3Like = Vector3>(position: Vec3Like, mass: number, dt: number, out: T): T {
  return gravityForce(position, mass * dt, out);
}

/** The bits of a Rapier rigid body the gravity step uses (structural, so tests can use rapier directly). */
export interface GravityBody {
  isDynamic(): boolean;
  isSleeping(): boolean;
  isEnabled(): boolean;
  gravityScale(): number;
  mass(): number;
  translation(): Vec3Like;
  applyImpulse(impulse: Vec3Like, wakeUp: boolean): void;
}

/** The bits of a Rapier world the gravity step uses. */
export interface GravityWorld {
  timestep: number;
  forEachRigidBody(f: (body: GravityBody) => void): void;
}

// Module-level scratch + visitor so a step allocates nothing of ours (Rapier's translation()
// still returns a small object per body; rapier-compat has no allocation-free getter).
const impulse: Vec3Like = { x: 0, y: 0, z: 0 };
let stepDt = 1 / 60;

function visitBody(body: GravityBody) {
  if (!body.isDynamic() || body.isSleeping() || !body.isEnabled()) return;
  const scale = body.gravityScale();
  if (scale === 0) return;
  gravityImpulse(body.translation(), body.mass() * scale, stepDt, impulse);
  body.applyImpulse(impulse, false);
}

/**
 * Applies one step of planet gravity to every awake dynamic body in `world`, as an impulse of
 * gravityForce × world.timestep (call it right before world.step()). Bodies' gravityScale
 * multiplies it (0 = opt out). See PlanetGravity.tsx for why impulses rather than forces.
 */
export function applyPlanetGravityStep(world: GravityWorld): void {
  stepDt = world.timestep;
  world.forEachRigidBody(visitBody);
}
