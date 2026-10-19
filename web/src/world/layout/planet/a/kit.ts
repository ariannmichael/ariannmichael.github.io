// Authoring helpers shared by the home, engineering and raceway layouts (biome agent A).
// Pure data maths only: safe at module top level (no surfacePose / terrainHeight here).
import { getModel } from "@/world/models";
import type { LatLon, PlanetPlacement } from "@/world/planet/types";
import { grid } from "../author";

type Rest = Omit<PlanetPlacement, "lat" | "lon">;

/** Yaw (degrees, CCW from above, 0 = north) that turns a model's +Z toward the (north, east) direction. */
export function yawToward(north: number, east: number): number {
  return (Math.atan2(-east, north) * 180) / Math.PI;
}

/**
 * Model-local offset (x, z in metres) → (north, east) offset for a placement turned by `yaw`.
 * At yaw 0 the model's +Z is north and its +X is WEST (right-handed frame with up = +Y).
 */
export function rotateLocal(x: number, z: number, yaw: number): [number, number] {
  const r = (yaw * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [z * c - x * s, -z * s - x * c];
}

/**
 * grid() plus `placeC`: like `place`, but (north, east) is where the model's footprint CENTRE lands.
 * Several kits (racing-kit flags, billboards, banner towers, holiday snowflakes) have their origin at
 * a cell corner, so a plain `place` would put them metres away from where you meant.
 */
export function author(center: LatLon) {
  const g = grid(center);
  const placeC = (north: number, east: number, rest: Rest): PlanetPlacement => {
    const { min, max } = getModel(rest.model);
    const s = rest.scale ?? 1;
    const [dn, de] = rotateLocal(((min[0] + max[0]) / 2) * s, ((min[2] + max[2]) / 2) * s, rest.yaw ?? 0);
    return g.place(north - dn, east - de, rest);
  };
  /** Offset (north, east) in metres from a local origin turned by `yaw` (for composing groups). */
  const local = (origin: [number, number], yaw: number) => (x: number, z: number): [number, number] => {
    const [dn, de] = rotateLocal(x, z, yaw);
    return [origin[0] + dn, origin[1] + de];
  };
  return { ...g, placeC, local };
}
