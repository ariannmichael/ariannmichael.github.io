// Pure placement math on the planet: lat/lon/yaw placements -> world matrices and oriented collider boxes.
// Every pose comes from planet/frame.ts `surfacePose`: model +Y = local up (radial), +Z = heading.
import { Matrix4, Quaternion, Vector3 } from "three";
import { headingAt, latLonToDir, surfaceFrame, surfacePose, surfaceRadius, type Pose } from "@/world/planet/frame";
import type { LatLon, PlanetMarker, PlanetPlacement } from "@/world/planet/types";
import { localColliderBox, type Vec3 } from "./placement";

export type Quat4 = [number, number, number, number];

// surfacePose samples terrainHeight (noise), so cache one pose per placement object. Layouts are
// static data, so the cache never goes stale. Callers must treat the returned pose as read-only.
const poseCache = new WeakMap<object, Pose>();

/** World pose of a placement: on the terrain at lat/lon, `y` metres above it, turned by `yaw`. */
export function placementPose(p: PlanetPlacement): Pose {
  let pose = poseCache.get(p);
  if (!pose) {
    pose = p.plane ? planePose(p, p.plane) : surfacePose(p.lat, p.lon, p.yaw ?? 0, p.y ?? 0);
    poseCache.set(p, pose);
  }
  return pose;
}

/**
 * Pose on the tangent plane through `anchor` (the centre of a planar pad): the point is where the
 * ray along the placement's direction meets the plane, up is the anchor's up, and the heading is the
 * placement's (local) heading projected onto the plane. `y` lifts along the anchor's up.
 */
function planePose(p: PlanetPlacement, anchor: LatLon): Pose {
  const n = latLonToDir(anchor.lat, anchor.lon);
  const level = surfaceRadius(n); // planar pad: the plane's distance from the centre
  const dir = latLonToDir(p.lat, p.lon);
  const position = dir.clone().multiplyScalar(level / Math.max(dir.dot(n), 0.5)).addScaledVector(n, p.y ?? 0);
  const heading = headingAt(surfaceFrame(dir), p.yaw ?? 0);
  const forward = heading.addScaledVector(n, -heading.dot(n)).normalize();
  const right = new Vector3().crossVectors(n, forward).normalize();
  return {
    position,
    quaternion: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, n, forward)),
  };
}

const _scale = new Vector3();

/**
 * Instance matrix of a placement: surface pose × uniform (kitScale × placement.scale).
 * The raw .glb is in Kenney units; the kit scale converts to metres.
 */
export function planetPlacementMatrix(p: PlanetPlacement, kitScale: number, out = new Matrix4()): Matrix4 {
  const pose = placementPose(p);
  const s = kitScale * (p.scale ?? 1);
  return out.compose(pose.position, pose.quaternion, _scale.set(s, s, s));
}

/** A box collider with its own orientation (Rapier colliders on a fixed body take position + rotation). */
export interface OrientedBox {
  center: Vec3;
  quaternion: Quat4;
  halfExtents: Vec3;
}

type Bounds = { min: Vec3; max: Vec3 };

/**
 * Collider box of a placement in world space. The model bounds (kit scale baked in) are a box in the
 * model's own frame, so the box keeps the placement's orientation and its centre is rotated into place.
 */
export function planetColliderBox(p: PlanetPlacement, bounds: Bounds): OrientedBox {
  const pose = placementPose(p);
  const local = localColliderBox(bounds, p.scale ?? 1);
  const c = new Vector3(...local.center).applyQuaternion(pose.quaternion).add(pose.position);
  const q = pose.quaternion;
  return { center: [c.x, c.y, c.z], quaternion: [q.x, q.y, q.z, q.w], halfExtents: local.halfExtents };
}

/** Marker frame on the terrain (yaw 0): the sensor, ground ring and label hang off it. */
export function markerPose(m: PlanetMarker): Pose {
  return surfacePose(m.lat, m.lon, 0, 0);
}

/**
 * Sensor box for a marker: `size` × `height` × `size`, standing on the ground and oriented to local up
 * (its centre is lifted half its height along up).
 */
export function markerSensorBox(m: PlanetMarker, size: number, height: number): OrientedBox {
  const pose = markerPose(m);
  const up = new Vector3(0, 1, 0).applyQuaternion(pose.quaternion);
  const c = pose.position.clone().addScaledVector(up, height / 2);
  const q = pose.quaternion;
  return {
    center: [c.x, c.y, c.z],
    quaternion: [q.x, q.y, q.z, q.w],
    halfExtents: [size / 2, height / 2, size / 2],
  };
}
