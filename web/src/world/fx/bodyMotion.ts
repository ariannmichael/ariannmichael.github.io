// Visual-only body motion for the car (pure): lean into turns, pitch under acceleration/braking, and a
// squash-and-stretch bounce on landings. Underdamped springs so the body overshoots a little and
// settles, like soft off-road suspension. The physics body is never touched: VehicleModel applies the
// result to the "body" node only, so the wheels stay planted.
import { clamp } from "@/world/lib/damping";

export const BODY = {
  /** Roll (rad) per m/s² of lateral acceleration, and its cap */
  rollPerAccel: 0.006,
  maxRoll: 0.1,
  /** Pitch (rad) per m/s² of longitudinal acceleration, and its cap */
  pitchPerAccel: 0.004,
  maxPitch: 0.07,
  /** Spring stiffness (1/s²) and damping ratio for roll/pitch */
  tiltStiffness: 90,
  tiltDamping: 0.5,
  /** Squash spring (bouncier) */
  squashStiffness: 160,
  squashDamping: 0.35,
  /** Squash velocity (1/s) added by a full-strength landing */
  squashImpulse: 3.2,
  /** Squash limits: positive = squashed (shorter, wider) */
  maxSquash: 0.22,
  minSquash: -0.12,
  /** Width gain per unit of squash (volume-ish preservation) */
  squashWiden: 0.5,
  /** Acceleration input smoothing (1/s): physics accelerations are spiky over bumps */
  accelLambda: 10,
  /** Integration substep (s) so the springs stay stable at low frame rates */
  maxStep: 1 / 120,
  /** Amplitude scale with prefers-reduced-motion (squash is off entirely) */
  reducedScale: 0.5,
} as const;

export interface BodyMotionState {
  /** Smoothed accelerations (m/s²): lateral (+ = towards the car's left, +X) and longitudinal (+ = forward) */
  lat: number;
  lon: number;
  roll: number;
  rollVel: number;
  pitch: number;
  pitchVel: number;
  squash: number;
  squashVel: number;
}

export function createBodyMotion(): BodyMotionState {
  return { lat: 0, lon: 0, roll: 0, rollVel: 0, pitch: 0, pitchVel: 0, squash: 0, squashVel: 0 };
}

/** Back to rest (teleports, resets). */
export function resetBodyMotion(s: BodyMotionState): void {
  s.lat = s.lon = s.roll = s.rollVel = s.pitch = s.pitchVel = s.squash = s.squashVel = 0;
}

/** Kick the squash spring (landings, hard hits). `strength` 0..1. */
export function kickSquash(s: BodyMotionState, strength: number): void {
  s.squashVel += BODY.squashImpulse * clamp(strength, 0, 1);
}

/** Semi-implicit Euler spring acceleration (no tuples: this runs every frame). */
function springAccel(x: number, v: number, target: number, k: number, zeta: number): number {
  return -k * (x - target) - 2 * zeta * Math.sqrt(k) * v;
}

/**
 * Advance the springs. `lat`/`lon` are the raw accelerations this frame (pass 0 in the air: no lean
 * without grip). Rotation conventions match the model (+Z nose, +X left): roll is about +Z (positive
 * tips the roof right, towards -X), pitch about +X (positive dips the nose).
 */
export function stepBodyMotion(s: BodyMotionState, lat: number, lon: number, dt: number): BodyMotionState {
  if (!(dt > 0)) return s;
  const f = 1 - Math.exp(-BODY.accelLambda * dt);
  s.lat += (lat - s.lat) * f;
  s.lon += (lon - s.lon) * f;
  // Cornering throws the roof to the outside of the turn. Turning left = acceleration towards +X, and
  // the roof should go right (-X): Rz(φ) moves +Y towards -X for φ > 0, so roll = +lat × gain.
  const rollTarget = clamp(s.lat * BODY.rollPerAccel, -BODY.maxRoll, BODY.maxRoll);
  // Accelerating lifts the nose (negative pitch), braking dips it
  const pitchTarget = clamp(-s.lon * BODY.pitchPerAccel, -BODY.maxPitch, BODY.maxPitch);

  let left = dt;
  while (left > 1e-6) {
    const h = Math.min(BODY.maxStep, left);
    left -= h;
    s.rollVel += springAccel(s.roll, s.rollVel, rollTarget, BODY.tiltStiffness, BODY.tiltDamping) * h;
    s.roll += s.rollVel * h;
    s.pitchVel += springAccel(s.pitch, s.pitchVel, pitchTarget, BODY.tiltStiffness, BODY.tiltDamping) * h;
    s.pitch += s.pitchVel * h;
    s.squashVel += springAccel(s.squash, s.squashVel, 0, BODY.squashStiffness, BODY.squashDamping) * h;
    s.squash += s.squashVel * h;
    if (s.squash > BODY.maxSquash || s.squash < BODY.minSquash) {
      s.squash = clamp(s.squash, BODY.minSquash, BODY.maxSquash);
      s.squashVel *= -0.3; // soft bump stop
    }
  }
  return s;
}
