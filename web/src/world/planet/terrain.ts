// STUB (contract): the terrain agent replaces the implementation, keeping these signatures.
import type { Vector3 } from "three";
import type { BiomeId } from "./types";

/** Terrain height in metres above PLANET_RADIUS along unit direction `dir`. */
export function terrainHeight(dir: Vector3): number {
  void dir;
  return 0;
}

/** Dominant biome at unit direction `dir`. */
export function biomeAt(dir: Vector3): BiomeId {
  void dir;
  return "home";
}
