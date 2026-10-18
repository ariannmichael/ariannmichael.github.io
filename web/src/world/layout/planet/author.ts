// Shared authoring helpers for biome layouts (coordinator-owned). Pure: imports only planet/sphere.ts
// (no terrain), so it is safe at module top level. Layouts must never import planet/frame.ts.
import { latLonToDir, offsetLatLon, surfaceFrame } from "@/world/planet/sphere";
import type { LatLon, PlanetMarker, PlanetPlacement } from "@/world/planet/types";

const DEG = Math.PI / 180;
const EPS = 0.01; // metres, for the finite-difference grid direction

/**
 * Local metric grid around a biome anchor: at(north, east) in metres → lat/lon on the sphere.
 * Yaws passed to `place`/`spawn` are in the GRID frame (0 = grid north), not the local north at the
 * point: meridians converge, so local north drifts up to ~16° from grid north 48 m from a mid-latitude
 * anchor (much more near the poles), which twisted neighbouring road tiles apart.
 */
export function grid(center: LatLon) {
  const at = (north: number, east: number): LatLon =>
    // offsetLatLon yaw: 0 = north, 90 = west (counter-clockwise), -90 = east
    offsetLatLon(offsetLatLon(center, north, 0), east, -90);

  /** Grid yaw → local yaw at (north, east). The grid is orthogonal, so grid north fixes the frame. */
  const localYaw = (north: number, east: number, yaw: number): number => {
    const a = at(north - EPS, east);
    const b = at(north + EPS, east);
    const p = at(north, east);
    const gridNorth = latLonToDir(b.lat, b.lon).sub(latLonToDir(a.lat, a.lon));
    const f = surfaceFrame(latLonToDir(p.lat, p.lon));
    return yaw + Math.atan2(-gridNorth.dot(f.east), gridNorth.dot(f.north)) / DEG;
  };

  const place = (north: number, east: number, rest: Omit<PlanetPlacement, "lat" | "lon">): PlanetPlacement => ({
    ...at(north, east),
    ...rest,
    yaw: localYaw(north, east, rest.yaw ?? 0),
  });

  const marker = (north: number, east: number, rest: Omit<PlanetMarker, "lat" | "lon">): PlanetMarker => ({
    ...at(north, east),
    ...rest,
  });

  const spawn = (north: number, east: number, yaw: number) => ({
    ...at(north, east),
    yaw: localYaw(north, east, yaw),
  });

  return { at, place, marker, spawn };
}
