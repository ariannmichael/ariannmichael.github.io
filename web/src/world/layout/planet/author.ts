// Shared authoring helpers for biome layouts (coordinator-owned). Pure: safe at module top level
// (never call surfacePose/terrainHeight at top level — import cycle with terrain pads).
import { offsetLatLon } from "@/world/planet/frame";
import type { LatLon, PlanetMarker, PlanetPlacement } from "@/world/planet/types";

/** Local metric grid around a biome anchor: at(north, east) in metres → lat/lon on the sphere. */
export function grid(center: LatLon) {
  const at = (north: number, east: number): LatLon =>
    // offsetLatLon yaw: 0 = north, 90 = west (counter-clockwise), -90 = east
    offsetLatLon(offsetLatLon(center, north, 0), east, -90);

  const place = (north: number, east: number, rest: Omit<PlanetPlacement, "lat" | "lon">): PlanetPlacement => ({
    ...at(north, east),
    ...rest,
  });

  const marker = (north: number, east: number, rest: Omit<PlanetMarker, "lat" | "lon">): PlanetMarker => ({
    ...at(north, east),
    ...rest,
  });

  return { at, place, marker };
}
