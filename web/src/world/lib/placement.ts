// Pure placement math: tile coordinates -> world transforms and collider boxes.
// Conventions: three.js is +Y up, metres, `rot` = quarter turns counter-clockwise seen from above
// (a positive rotation around +Y, which turns +X towards -Z).
import { Matrix4, Quaternion, Vector3 } from "three";
import { TILE, type Placement, type Rot } from "@/world/layout/types";
import type { ModelInfo } from "@/world/models/types";

export type Vec3 = [number, number, number];

export interface TileOrigin {
  x: number;
  z: number;
}

/** Yaw in radians for a quarter-turn count. */
export function rotToYaw(rot: Rot | undefined): number {
  return ((rot ?? 0) * Math.PI) / 2;
}

/** World position (metres) of a point given in tile coordinates relative to a district origin. */
export function tileToWorld(origin: TileOrigin, x: number, z: number, y = 0): Vec3 {
  return [(origin.x + x) * TILE, y, (origin.z + z) * TILE];
}

export function placementPosition(origin: TileOrigin, p: Placement): Vec3 {
  return tileToWorld(origin, p.x, p.z, p.y ?? 0);
}

const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _up = new Vector3(0, 1, 0);

/**
 * World matrix of a placement: translate to the tile, rotate by quarter turns around +Y, then
 * scale by kitScale * placement.scale (the raw .glb is in Kenney units; the kit scale converts to metres).
 */
export function placementMatrix(
  origin: TileOrigin,
  p: Placement,
  kitScale: number,
  out: Matrix4 = new Matrix4(),
): Matrix4 {
  const [x, y, z] = placementPosition(origin, p);
  const s = kitScale * (p.scale ?? 1);
  _pos.set(x, y, z);
  _quat.setFromAxisAngle(_up, rotToYaw(p.rot));
  _scale.set(s, s, s);
  return out.compose(_pos, _quat, _scale);
}

/** Rotate a horizontal vector by `rot` quarter turns around +Y (exact, no floating-point drift). */
export function rotateQuarter(x: number, z: number, rot: Rot | undefined): [number, number] {
  // Rotation around +Y by theta: x' = x cos + z sin, z' = -x sin + z cos
  switch (rot ?? 0) {
    case 1:
      return [z, -x];
    case 2:
      return [-x, -z];
    case 3:
      return [-z, x];
    default:
      return [x, z];
  }
}

export interface ColliderBox {
  /** Centre of the box in world metres */
  center: Vec3;
  /** Half extents in world metres (axis-aligned, rotation already folded in) */
  halfExtents: Vec3;
}

type Bounds = Pick<ModelInfo, "min" | "max">;

/**
 * Box collider for a placement from the model bounds (bounds already include the kit scale).
 * Quarter-turn rotations keep the box axis-aligned, so we only swap x/z extents and rotate the centre.
 */
export function placementColliderBox(origin: TileOrigin, p: Placement, bounds: Bounds): ColliderBox {
  const s = p.scale ?? 1;
  const [px, py, pz] = placementPosition(origin, p);
  const cx = ((bounds.min[0] + bounds.max[0]) / 2) * s;
  const cy = ((bounds.min[1] + bounds.max[1]) / 2) * s;
  const cz = ((bounds.min[2] + bounds.max[2]) / 2) * s;
  const hx = ((bounds.max[0] - bounds.min[0]) / 2) * s;
  const hy = ((bounds.max[1] - bounds.min[1]) / 2) * s;
  const hz = ((bounds.max[2] - bounds.min[2]) / 2) * s;
  const [rcx, rcz] = rotateQuarter(cx, cz, p.rot);
  const odd = (p.rot ?? 0) % 2 === 1;
  return {
    center: [px + rcx, py + cy, pz + rcz],
    halfExtents: odd ? [hz, hy, hx] : [hx, hy, hz],
  };
}

/** Model-local box (for dynamic bodies, whose body transform carries position and rotation). */
export function localColliderBox(bounds: Bounds, scale = 1): ColliderBox {
  return {
    center: [
      ((bounds.min[0] + bounds.max[0]) / 2) * scale,
      ((bounds.min[1] + bounds.max[1]) / 2) * scale,
      ((bounds.min[2] + bounds.max[2]) / 2) * scale,
    ],
    halfExtents: [
      ((bounds.max[0] - bounds.min[0]) / 2) * scale,
      ((bounds.max[1] - bounds.min[1]) / 2) * scale,
      ((bounds.max[2] - bounds.min[2]) / 2) * scale,
    ],
  };
}

/** Anything shorter than this (metres) is treated as drivable ground: road tiles, decals, kerbs. */
export const GROUND_HEIGHT_THRESHOLD = 0.3;

/**
 * Collider rule. An explicit `placement.collider` always wins. Otherwise road/ground tiles and flat
 * pieces are drive-through ("none") and everything else gets a box. Unknown models get "none"
 * because we have no bounds to build a box from.
 */
export function resolveCollider(p: Placement, bounds: Bounds | undefined): "box" | "none" {
  if (p.collider) return p.collider;
  if (!bounds) return "none";
  if (isGroundRef(p.model)) return "none";
  const height = (bounds.max[1] - bounds.min[1]) * (p.scale ?? 1);
  return height < GROUND_HEIGHT_THRESHOLD ? "none" : "box";
}

/** Road and ground tiles by naming convention, regardless of their height. */
export function isGroundRef(ref: string): boolean {
  const slash = ref.indexOf("/");
  const kit = ref.slice(0, slash);
  const model = ref.slice(slash + 1);
  if (model.startsWith("tile-") || model === "tile") return true;
  if (kit === "city-roads" && model.startsWith("road-")) return true;
  if (kit.includes("racing") && model.startsWith("road")) return true;
  return false;
}
