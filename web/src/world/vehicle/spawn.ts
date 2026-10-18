// Spawn/teleport poses on the planet and a tiny teleport request channel.
import { Vector3 } from "three";
import { dirToLatLon, surfacePose, type Pose } from "@/world/planet/frame";
import type { LatLon } from "@/world/planet/types";
import { VEHICLE } from "./constants";

/** Where (and facing which way) to put the car. yaw: degrees CCW from local north, 0 = nose north. */
export type SpawnPoint = LatLon & { yaw: number };

const DEG = Math.PI / 180;
const WORLD_Y = new Vector3(0, 1, 0);
const WORLD_X = new Vector3(1, 0, 0);

/** Car pose `height` metres above the terrain at a spawn point, upright on the local surface. */
export function vehicleSpawnPose(spawn: SpawnPoint, height: number = VEHICLE.spawnHeight): Pose {
  return surfacePose(spawn.lat, spawn.lon, spawn.yaw, height);
}

/**
 * East/north at a unit `up`, written into the outputs (no allocation; same convention as
 * planet/frame `surfaceFrame`).
 */
export function tangentBasis(up: Vector3, east: Vector3, north: Vector3): void {
  east.crossVectors(WORLD_Y, up);
  if (east.lengthSq() < 1e-8) east.crossVectors(up, WORLD_X).negate();
  east.normalize();
  north.crossVectors(up, east).normalize();
}

const _e = new Vector3();
const _n = new Vector3();

/** Yaw (degrees, CCW from north) of a tangent `heading` at unit `up`. Inverse of frame.headingAt. */
export function yawOfHeading(up: Vector3, heading: Vector3): number {
  tangentBasis(up, _e, _n);
  return Math.atan2(-heading.dot(_e), heading.dot(_n)) / DEG;
}

/** Spawn point at a world position keeping a heading: used by the in-place reset (R). */
export function spawnPointAt(position: Vector3, heading: Vector3): SpawnPoint {
  const up = position.clone().normalize();
  return { ...dirToLatLon(up), yaw: yawOfHeading(up, heading) };
}

// --- Teleport requests: anything can ask the mounted <Vehicle> to move (GPS, debug, integration) ---

type TeleportListener = (spawn: SpawnPoint) => void;
let listener: TeleportListener | null = null;

/** Move the car to a spawn point (with the fade). No-op until <Vehicle> is mounted. */
export function requestVehicleTeleport(spawn: SpawnPoint): void {
  listener?.(spawn);
}

/** @internal Vehicle registers itself here. Returns an unsubscribe. */
export function onTeleportRequest(fn: TeleportListener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
