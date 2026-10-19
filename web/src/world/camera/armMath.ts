// Pure spring-arm maths for the follow camera (no physics engine, no React): how far along the arm
// from the pivot above the car the camera may sit, how that distance is smoothed (fast in, slow out),
// and how a low ceiling caps the camera's height. The Rapier queries live in ./cameraCollision.
import type { Vector3 } from "three";
import { clamp, dampFactor } from "@/world/lib/damping";

export const ARM = {
  /** Pivot height above the car's origin (m): just over the roof (chassis top ≈ 2.14 m) */
  pivotHeight: 2.4,
  /** Radius of the sphere swept along the arm (m). Covers the near plane and thin gaps. */
  probeRadius: 0.3,
  /** Extra gap kept between the swept sphere and what it hit (m) */
  margin: 0.1,
  /** The arm never shrinks below this (m): the camera stays a little behind the pivot */
  minLength: 1.4,
  /** Pull-in rate (1/s): fast, so a wall never fills the screen */
  inLambda: 22,
  /** Ease-out rate (1/s): slow, so the camera doesn't pop back when the obstacle clears */
  outLambda: 2.2,
  /** Smoothing may lag the obstacle by at most this much (m) before it's hard-clamped */
  slack: 0.15,
  /** Keep this much air between the camera and a ceiling over the car (m) */
  ceilingMargin: 0.55,
  /** Ceiling probe reaches this far above the pivot (m); higher roofs don't matter */
  ceilingProbe: 5,
  /** Cap rate when the ceiling rises again (1/s); lowering is immediate */
  ceilingOutLambda: 1.5,
} as const;

/**
 * Target arm ratio (0..1 of the full arm) given the free distance to the first obstacle along it.
 * `hit` is the sphere's time of impact in metres, or null for a clear arm.
 */
export function armTargetRatio(
  hit: number | null,
  length: number,
  margin: number = ARM.margin,
  minLength: number = ARM.minLength,
): number {
  if (hit === null || length <= 1e-6) return 1;
  const allowed = Math.max(hit - margin, Math.min(minLength, length));
  return clamp(allowed / length, 0, 1);
}

/**
 * Asymmetric smoothing of the arm ratio: towards a shorter arm at `inLambda`, back out at `outLambda`,
 * and never more than `slack` metres beyond the target (so smoothing can't push into a wall).
 */
export function smoothArmRatio(
  current: number,
  target: number,
  length: number,
  dt: number,
  inLambda: number = ARM.inLambda,
  outLambda: number = ARM.outLambda,
  slack: number = ARM.slack,
): number {
  const lambda = target < current ? inLambda : outLambda;
  const next = current + (target - current) * dampFactor(lambda, dt);
  const limit = length > 1e-6 ? target + slack / length : 1;
  return clamp(Math.min(next, limit), 0, 1);
}

/**
 * Highest the camera may sit above the car's origin given a ceiling hit `hit` metres above the pivot
 * (null: open sky → Infinity). Never below the pivot itself.
 */
export function ceilingCap(
  hit: number | null,
  pivotHeight: number = ARM.pivotHeight,
  margin: number = ARM.ceilingMargin,
): number {
  if (hit === null) return Infinity;
  return Math.max(pivotHeight, pivotHeight + hit - margin);
}

/**
 * Smooth a ceiling cap: lowering applies at once (we're already under the roof), raising eases at
 * `outLambda` so driving out from under a roof doesn't jerk the camera up. Infinity is "no cap".
 */
export function smoothCeilingCap(current: number, target: number, dt: number, outLambda: number = ARM.ceilingOutLambda): number {
  if (target <= current) return target;
  if (!Number.isFinite(target)) {
    // Ease towards a generous finite height, then release the cap entirely
    const next = current + (CAP_RELEASE - current) * dampFactor(outLambda, dt);
    return next >= CAP_RELEASE - 0.5 ? Infinity : next;
  }
  return current + (target - current) * dampFactor(outLambda, dt);
}
/** A cap this high is as good as none (the follow camera sits ≈ 4 m above the car) */
const CAP_RELEASE = 12;

/**
 * Lower `pos` along unit `up` so it's at most `maxHeight` above `origin` (measured along `up`).
 * Returns how much it moved (m).
 */
export function capHeight(pos: Vector3, origin: Vector3, up: Vector3, maxHeight: number): number {
  if (!Number.isFinite(maxHeight)) return 0;
  const h = (pos.x - origin.x) * up.x + (pos.y - origin.y) * up.y + (pos.z - origin.z) * up.z;
  if (h <= maxHeight) return 0;
  pos.addScaledVector(up, maxHeight - h);
  return h - maxHeight;
}
