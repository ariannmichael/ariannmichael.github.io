// Pure camera math on the planet: follow offsets in the car's local frame (up = radial, heading on the
// tangent plane), terrain clearance and line-of-sight lift, the intro orbit and the speed FOV.
// Everything writes into caller-owned vectors so per-frame code never allocates.
import { Vector3 } from "three";
import { clamp } from "@/world/lib/damping";
import { surfaceRadius } from "@/world/planet/frame";
import { tangentBasis } from "@/world/vehicle/spawn";

export const CAMERA = {
  /** Distance behind the car at rest (m), plus extra per m/s */
  distance: 9,
  distancePerSpeed: 0.12,
  /** Height above the car along local up (m), plus extra per m/s */
  height: 3.6,
  heightPerSpeed: 0.03,
  /** Look this far ahead of the car (m), scaled up with forward speed */
  lookAhead: 3,
  lookAheadPerSpeed: 0.15,
  lookHeight: 1.4,
  /** Damping rates (1/s) */
  positionLambda: 5,
  lookLambda: 9,
  upLambda: 4,
  headingLambda: 5,
  /** Field of view and a speed kick */
  fov: 55,
  fovPerSpeed: 0.4,
  maxFov: 68,
  /** The camera never goes below terrain + this (m) */
  minClearance: 1.2,
  /** Line of sight from the look point to the camera keeps this much air over the terrain (m) */
  losClearance: 0.6,
  losSamples: 8,
  /** Intro orbit around the spawn: high enough to see the planet curve away */
  orbitRadius: 60,
  orbitHeight: 70,
  orbitSpeed: 0.1,
  orbitSpeedReduced: 0.03,
  /** Seconds to fly from the orbit into the follow cam */
  introBlend: 1.8,
} as const;

/** Radius of the ground (planet centre → terrain surface) along a unit direction. */
export type SurfaceFn = (dir: Vector3) => number;

const _dir = new Vector3();
const _p = new Vector3();
const _e = new Vector3();
const _n = new Vector3();

/** Desired camera position: behind the car along `heading` and above it along `up`. */
export function followPosition(car: Vector3, up: Vector3, heading: Vector3, speed: number, out: Vector3): Vector3 {
  const s = Math.abs(speed);
  const d = CAMERA.distance + CAMERA.distancePerSpeed * s;
  const h = CAMERA.height + CAMERA.heightPerSpeed * s;
  return out.copy(car).addScaledVector(heading, -d).addScaledVector(up, h);
}

/** Point the follow camera looks at: a little ahead of and above the car. */
export function followLookAt(car: Vector3, up: Vector3, heading: Vector3, speed: number, out: Vector3): Vector3 {
  const ahead = CAMERA.lookAhead + CAMERA.lookAheadPerSpeed * Math.max(0, speed);
  return out.copy(car).addScaledVector(heading, ahead).addScaledVector(up, CAMERA.lookHeight);
}

export function followFov(speed: number): number {
  return clamp(CAMERA.fov + CAMERA.fovPerSpeed * Math.abs(speed), CAMERA.fov, CAMERA.maxFov);
}

/** Push `pos` radially out so it's at least `clearance` above the terrain. Returns the lift (m). */
export function clampAboveTerrain(pos: Vector3, clearance: number, surface: SurfaceFn = surfaceRadius): number {
  const r = pos.length();
  if (r < 1e-6) return 0;
  _dir.copy(pos).divideScalar(r);
  const min = surface(_dir) + clearance;
  if (r >= min) return 0;
  pos.copy(_dir).multiplyScalar(min);
  return min - r;
}

/**
 * Raise `cam` along its local up until the segment from `target` to `cam` clears the terrain by
 * `clearance`. A hill between car and camera would otherwise fill the screen. Lifting the camera by L
 * lifts a point at fraction f of the segment by ≈ f·L, so each sample asks for deficit / f.
 * Returns the lift applied (m).
 */
export function liftForLineOfSight(
  target: Vector3,
  cam: Vector3,
  clearance: number,
  samples: number = CAMERA.losSamples,
  surface: SurfaceFn = surfaceRadius,
): number {
  let lift = 0;
  for (let i = 1; i <= samples; i++) {
    const f = i / samples;
    _p.copy(target).lerp(cam, f);
    const r = _p.length();
    _dir.copy(_p).divideScalar(r);
    const deficit = surface(_dir) + clearance - r;
    if (deficit > 0) lift = Math.max(lift, deficit / f);
  }
  if (lift > 0) cam.addScaledVector(_dir.copy(cam).normalize(), lift);
  return lift;
}

/** Point on the intro orbit around `center` (on the ground) at `angle`, in its tangent plane. */
export function orbitPosition(center: Vector3, up: Vector3, angle: number, out: Vector3): Vector3 {
  tangentBasis(up, _e, _n);
  return out
    .copy(center)
    .addScaledVector(_e, Math.cos(angle) * CAMERA.orbitRadius)
    .addScaledVector(_n, Math.sin(angle) * CAMERA.orbitRadius)
    .addScaledVector(up, CAMERA.orbitHeight);
}

/** Re-project `v` onto the tangent plane of unit `up` and normalise; keeps `fallback` if degenerate. */
export function projectToTangent(v: Vector3, up: Vector3, fallback: Vector3): Vector3 {
  v.addScaledVector(up, -v.dot(up));
  if (v.lengthSq() < 1e-8) v.copy(fallback).addScaledVector(up, -fallback.dot(up));
  return v.normalize();
}
