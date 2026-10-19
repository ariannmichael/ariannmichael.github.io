// Terrain-aware placement maths (coordinator-owned contract). The pure sphere maths lives in
// sphere.ts (re-exported here); this module adds the parts that need terrainHeight.
// Never import this module from layout files at module top level — use sphere.ts there.

import { Matrix4, Quaternion, Vector3 } from "three";
import { PLANET_RADIUS } from "./config";
import { headingAt, latLonToDir, surfaceFrame } from "./sphere";
import { terrainHeight } from "./terrain";

export * from "./sphere";

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

