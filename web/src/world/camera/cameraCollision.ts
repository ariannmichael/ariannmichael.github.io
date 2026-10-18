// Rapier scene queries for the follow camera: a sphere swept along the spring arm and a ray probing
// for a ceiling over the car. FollowCamera lives outside <Physics>, so <CameraCollisionBridge> (inside
// it) registers the world here. Until it does, the probes report "clear" and the camera falls back to
// terrain-only avoidance. Only type imports from rapier: the WASM module comes in through the bridge.
import type { Ball, Ray, Rotation, Vector as RapierVector, World } from "@dimforge/rapier3d-compat";
import type { Vector3 } from "three";

/** The slice of a Rapier World the camera uses (a fake one is enough in tests). */
export type CameraQueryWorld = Pick<World, "castRay" | "castShape">;

/** The slice of the rapier namespace needed to build the reusable query objects. */
export interface CameraRapier {
  Ray: new (origin: RapierVector, dir: RapierVector) => Ray;
  Ball: new (radius: number) => Ball;
}

/**
 * Skip dynamic bodies (the car itself, cones, crates, barrels, tyres) and sensors (zone triggers):
 * QueryFilterFlags.EXCLUDE_DYNAMIC (4) | EXCLUDE_SENSORS (8). Fixed colliders (buildings, interior
 * walls, roofs and the planet trimesh) are what the camera must stay out of.
 */
export const CAMERA_QUERY_FLAGS = 4 | 8;

interface Probe {
  world: CameraQueryWorld;
  ray: Ray;
  ball: Ball;
  radius: number;
}

let probe: Probe | null = null;
// Reused query inputs: Rapier copies plain {x,y,z} objects, so these never escape
const _pos = { x: 0, y: 0, z: 0 };
const _vel = { x: 0, y: 0, z: 0 };
const IDENTITY: Rotation = { x: 0, y: 0, z: 0, w: 1 };

/** Register the physics world (called by CameraCollisionBridge). Returns the unregister function. */
export function registerCameraWorld(world: CameraQueryWorld, rapier: CameraRapier, radius: number): () => void {
  const mine: Probe = {
    world,
    ray: new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
    ball: new rapier.Ball(radius),
    radius,
  };
  probe = mine;
  return () => {
    if (probe === mine) probe = null;
  };
}

export function hasCameraWorld(): boolean {
  return probe !== null;
}

/**
 * Sweep the probe sphere from `from` along unit `dir` for up to `maxDist` metres. Returns the distance
 * the sphere centre travels before touching fixed geometry, or null when the path is clear.
 * Starting slightly inside something (scraping a wall) doesn't count if the sweep moves out of it.
 */
export function sweepArm(from: Vector3, dir: Vector3, maxDist: number): number | null {
  if (!probe || !(maxDist > 0)) return null;
  _pos.x = from.x;
  _pos.y = from.y;
  _pos.z = from.z;
  _vel.x = dir.x;
  _vel.y = dir.y;
  _vel.z = dir.z;
  const hit = probe.world.castShape(_pos, IDENTITY, _vel, probe.ball, 0, maxDist, false, CAMERA_QUERY_FLAGS);
  return hit ? hit.time_of_impact : null;
}

/** Cast a ray from `from` along unit `dir`; distance to the first fixed collider or null. */
export function probeRay(from: Vector3, dir: Vector3, maxDist: number): number | null {
  if (!probe || !(maxDist > 0)) return null;
  const r = probe.ray;
  r.origin.x = from.x;
  r.origin.y = from.y;
  r.origin.z = from.z;
  r.dir.x = dir.x;
  r.dir.y = dir.y;
  r.dir.z = dir.z;
  const hit = probe.world.castRay(r, maxDist, true, CAMERA_QUERY_FLAGS);
  return hit ? hit.timeOfImpact : null;
}
