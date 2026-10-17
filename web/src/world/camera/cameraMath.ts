// Pure camera math: follow-cam offsets and the intro orbit. Writes into caller-owned arrays/vectors
// so the per-frame code never allocates.
import { clamp } from "@/world/lib/damping";

export const CAMERA = {
  /** Distance behind the car at rest (m) */
  distance: 8.5,
  /** Extra distance at top speed (m) */
  distancePerSpeed: 0.14,
  height: 4.2,
  heightPerSpeed: 0.04,
  /** Look this far ahead of the car (m), scaled up a little with speed */
  lookAhead: 2.5,
  lookAheadPerSpeed: 0.12,
  lookHeight: 1.1,
  /** Damping rates (1/s) */
  positionLambda: 5,
  lookLambda: 9,
  /** Field of view and a small speed kick */
  fov: 55,
  fovPerSpeed: 0.35,
  maxFov: 66,
  /** Intro orbit */
  orbitRadius: 46,
  orbitHeight: 26,
  orbitSpeed: 0.12,
  orbitSpeedReduced: 0.04,
  /** Seconds to fly from the orbit into the follow cam */
  introBlend: 1.6,
  /** Subtle high-speed shake amplitude (m); disabled with prefers-reduced-motion */
  shake: 0.035,
} as const;

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** Desired camera position behind the car (yaw 0 faces +Z, so "behind" is -Z). */
export function followPosition(car: Vec3Like, yaw: number, speed: number, out: Vec3Like): Vec3Like {
  const s = Math.abs(speed);
  const d = CAMERA.distance + CAMERA.distancePerSpeed * s;
  const h = CAMERA.height + CAMERA.heightPerSpeed * s;
  out.x = car.x - Math.sin(yaw) * d;
  out.y = car.y + h;
  out.z = car.z - Math.cos(yaw) * d;
  return out;
}

/** Point the follow camera looks at: a little ahead of the car. */
export function followLookAt(car: Vec3Like, yaw: number, speed: number, out: Vec3Like): Vec3Like {
  const ahead = CAMERA.lookAhead + CAMERA.lookAheadPerSpeed * Math.max(0, speed);
  out.x = car.x + Math.sin(yaw) * ahead;
  out.y = car.y + CAMERA.lookHeight;
  out.z = car.z + Math.cos(yaw) * ahead;
  return out;
}

export function followFov(speed: number): number {
  return clamp(CAMERA.fov + CAMERA.fovPerSpeed * Math.abs(speed), CAMERA.fov, CAMERA.maxFov);
}

/** Point on the intro orbit around `center` at `angle`. */
export function orbitPosition(center: Vec3Like, angle: number, out: Vec3Like): Vec3Like {
  out.x = center.x + Math.cos(angle) * CAMERA.orbitRadius;
  out.y = center.y + CAMERA.orbitHeight;
  out.z = center.z + Math.sin(angle) * CAMERA.orbitRadius;
  return out;
}
