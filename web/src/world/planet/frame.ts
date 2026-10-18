// Sphere frame math (coordinator-owned contract). Planet centre = world origin.
// Convention: lat 0, lon 0 = +Z; north pole (lat 90) = +Y; positive lon turns toward +X.
// Local frame at a surface point: up = radial, east = Y × up (fallback at poles), north = up × east.
// Yaw is counter-clockwise seen from above (right-handed about up); yaw 0 = model +Z faces north.

import { Matrix4, Quaternion, Vector3 } from "three";
import { PLANET_RADIUS } from "./config";
import { terrainHeight } from "./terrain";
import type { LatLon } from "./types";

const DEG = Math.PI / 180;
const WORLD_Y = new Vector3(0, 1, 0);
const WORLD_X = new Vector3(1, 0, 0);

export function latLonToDir(lat: number, lon: number, out = new Vector3()): Vector3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

export function dirToLatLon(dir: Vector3): LatLon {
  const d = dir.clone().normalize();
  return { lat: Math.asin(Math.max(-1, Math.min(1, d.y))) / DEG, lon: Math.atan2(d.x, d.z) / DEG };
}

/** Unit "up" at any world position (radial). */
export function upAt(position: Vector3, out = new Vector3()): Vector3 {
  return out.copy(position).normalize();
}

export interface SurfaceFrame {
  up: Vector3;
  east: Vector3;
  north: Vector3;
}

export function surfaceFrame(up: Vector3): SurfaceFrame {
  const u = up.clone().normalize();
  const east = new Vector3().crossVectors(WORLD_Y, u);
  if (east.lengthSq() < 1e-8) east.crossVectors(u, WORLD_X).negate(); // at the poles
  east.normalize();
  const north = new Vector3().crossVectors(u, east).normalize();
  return { up: u, east, north };
}

/** Heading vector on the tangent plane for `yawDeg` (CCW from above, 0 = north). */
export function headingAt(frame: SurfaceFrame, yawDeg: number, out = new Vector3()): Vector3 {
  const y = yawDeg * DEG;
  return out.copy(frame.north).multiplyScalar(Math.cos(y)).addScaledVector(frame.east, -Math.sin(y)).normalize();
}

/** Surface radius (centre to ground) along unit direction `dir`. */
export function surfaceRadius(dir: Vector3): number {
  return PLANET_RADIUS + terrainHeight(dir);
}

export interface Pose {
  position: Vector3;
  quaternion: Quaternion;
}

/**
 * Pose for something standing on the terrain at lat/lon: model +Y = local up, +Z = heading.
 * `height` is metres above the terrain surface.
 */
export function surfacePose(lat: number, lon: number, yawDeg = 0, height = 0): Pose {
  const dir = latLonToDir(lat, lon);
  const frame = surfaceFrame(dir);
  const forward = headingAt(frame, yawDeg);
  const right = new Vector3().crossVectors(frame.up, forward).normalize();
  const basis = new Matrix4().makeBasis(right, frame.up, forward);
  return {
    position: dir.clone().multiplyScalar(surfaceRadius(dir) + height),
    quaternion: new Quaternion().setFromRotationMatrix(basis),
  };
}

/** Arc length on the mean sphere ↔ degrees. */
export const metresToDeg = (m: number) => (m / PLANET_RADIUS) / DEG;
export const degToMetres = (deg: number) => deg * DEG * PLANET_RADIUS;

/** Great-circle angle between two lat/lon points, degrees. */
export function angleBetween(a: LatLon, b: LatLon): number {
  return latLonToDir(a.lat, a.lon).angleTo(latLonToDir(b.lat, b.lon)) / DEG;
}

/**
 * Lat/lon reached by walking `metres` from `from` along heading `yawDeg` (great circle).
 * Handy for authoring layouts relative to a point ("12 m east of the clinic").
 */
export function offsetLatLon(from: LatLon, metres: number, yawDeg: number): LatLon {
  const p = latLonToDir(from.lat, from.lon);
  const h = headingAt(surfaceFrame(p), yawDeg);
  const a = metres / PLANET_RADIUS;
  const q = p.clone().multiplyScalar(Math.cos(a)).addScaledVector(h, Math.sin(a));
  return dirToLatLon(q);
}
