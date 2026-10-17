// Pure area math: district rectangles, town extents, spawn poses.
import type { DistrictId } from "@/content/types";
import { TILE, type DistrictLayout } from "@/world/layout/types";
import { rotToYaw, tileToWorld, type Vec3 } from "./placement";

/** Axis-aligned rectangle on the ground plane, in world metres. */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * World rectangle covered by a district: every placement, marker and the spawn, each padded by half
 * a tile (tile coordinates are tile centres) plus `marginTiles`.
 */
export function districtRect(layout: DistrictLayout, marginTiles = 0): Rect {
  const pts: { x: number; z: number }[] = [
    ...layout.placements,
    ...layout.markers,
    layout.spawn,
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const pad = 0.5 + marginTiles;
  return {
    minX: (layout.origin.x + minX - pad) * TILE,
    maxX: (layout.origin.x + maxX + pad) * TILE,
    minZ: (layout.origin.z + minZ - pad) * TILE,
    maxZ: (layout.origin.z + maxZ + pad) * TILE,
  };
}

/** Union of all district rectangles. Falls back to one tile around the origin when there are none. */
export function townRect(layouts: readonly DistrictLayout[], marginTiles = 0): Rect {
  if (layouts.length === 0) {
    const h = (0.5 + marginTiles) * TILE;
    return { minX: -h, maxX: h, minZ: -h, maxZ: h };
  }
  return layouts
    .map((l) => districtRect(l, marginTiles))
    .reduce((a, b) => ({
      minX: Math.min(a.minX, b.minX),
      maxX: Math.max(a.maxX, b.maxX),
      minZ: Math.min(a.minZ, b.minZ),
      maxZ: Math.max(a.maxZ, b.maxZ),
    }));
}

export function rectContains(r: Rect, x: number, z: number): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

/** First district whose rectangle contains the point, or null. */
export function districtAt(
  rects: readonly { id: DistrictId; rect: Rect }[],
  x: number,
  z: number,
): DistrictId | null {
  for (const d of rects) if (rectContains(d.rect, x, z)) return d.id;
  return null;
}

export interface SpawnPose {
  /** Ground point (y = 0) in world metres */
  position: Vec3;
  /** Heading in radians; 0 faces +Z */
  yaw: number;
}

/** Spawn pose for a district; falls back to the first layout, then to the world origin. */
export function spawnPose(layouts: readonly DistrictLayout[], id: DistrictId): SpawnPose {
  const layout = layouts.find((l) => l.id === id) ?? layouts[0];
  if (!layout) return { position: [0, 0, 0], yaw: 0 };
  return {
    position: tileToWorld(layout.origin, layout.spawn.x, layout.spawn.z),
    yaw: rotToYaw(layout.spawn.rot),
  };
}
