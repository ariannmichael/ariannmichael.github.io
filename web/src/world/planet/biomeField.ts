// Smooth biome blend weights over the sphere.
// Each biome is a spherical cap (centre + radiusDeg). For a direction we take the signed angular
// distance to every cap's edge (negative inside), wobble it with noise so borders aren't perfect
// circles, then weight each biome by how close it is to the *nearest* cap edge. That covers the
// whole sphere (gaps between caps go to the nearest biome) with soft borders ~10° wide.

import type { Vector3 } from "three";
import { BIOMES } from "./biomes";
import { createNoise3D, fbm, smoothstep } from "./noise";
import type { BiomeId } from "./types";

const DEG = Math.PI / 180;

export const BIOME_COUNT = BIOMES.length;

/**
 * Edge-distance difference (degrees) over which a biome fades out against the nearest one.
 * Moving across a border changes the difference ~2° per degree, so the visible blend band is
 * about BORDER_DEG / 2 ≈ 11° (≈ 29 m at R = 150) wide.
 */
export const BORDER_DEG = 22;
/** Border wobble amplitude (degrees) */
const WOBBLE_DEG = 6;

const borderNoise = createNoise3D(7331);

// Biome centres as unit vectors (same convention as frame.latLonToDir; inlined to avoid an import
// cycle frame → terrain → biomeField → frame).
const CENTERS = new Float64Array(BIOME_COUNT * 3);
const RADII = new Float64Array(BIOME_COUNT);
BIOMES.forEach((b, i) => {
  const la = b.center.lat * DEG;
  const lo = b.center.lon * DEG;
  CENTERS[i * 3] = Math.cos(la) * Math.sin(lo);
  CENTERS[i * 3 + 1] = Math.sin(la);
  CENTERS[i * 3 + 2] = Math.cos(la) * Math.cos(lo);
  RADII[i] = b.radiusDeg;
});

const scratchEdge = new Float64Array(BIOME_COUNT);
const sharedWeights = new Float32Array(BIOME_COUNT);

/** Index of `id` in BIOMES (−1 if unknown). */
export function biomeIndex(id: BiomeId): number {
  return BIOMES.findIndex((b) => b.id === id);
}

/** Unit-vector centre of biome `i` (read-only view into a shared table). */
export function biomeCenter(i: number): [number, number, number] {
  return [CENTERS[i * 3], CENTERS[i * 3 + 1], CENTERS[i * 3 + 2]];
}

function edgeDistances(x: number, y: number, z: number): number {
  // Each biome's wobble samples the noise at its own offset, so neighbouring borders differ.
  let min = Infinity;
  for (let i = 0; i < BIOME_COUNT; i++) {
    const c = x * CENTERS[i * 3] + y * CENTERS[i * 3 + 1] + z * CENTERS[i * 3 + 2];
    const ang = Math.acos(c > 1 ? 1 : c < -1 ? -1 : c) / DEG;
    const wob = WOBBLE_DEG * fbm(borderNoise, x * 3 + i * 11.7, y * 3, z * 3, 2);
    const e = ang - RADII[i] + wob;
    scratchEdge[i] = e;
    if (e < min) min = e;
  }
  return min;
}

/**
 * Blend weights (sum = 1) of every biome at unit direction `dir`, in BIOMES order.
 * Writes into `out` (or a shared scratch array — copy it if you need to keep it). No allocations.
 */
export function biomeWeights(dir: Vector3, out: Float32Array = sharedWeights): Float32Array {
  return biomeWeightsXYZ(dir.x, dir.y, dir.z, out);
}

/** Same as biomeWeights, for callers that hold raw components (the mesh builder). */
export function biomeWeightsXYZ(
  x: number,
  y: number,
  z: number,
  out: Float32Array = sharedWeights,
): Float32Array {
  const min = edgeDistances(x, y, z);
  let sum = 0;
  for (let i = 0; i < BIOME_COUNT; i++) {
    const w = 1 - smoothstep(0, BORDER_DEG, scratchEdge[i] - min);
    out[i] = w;
    sum += w;
  }
  // sum ≥ 1 always (the nearest biome has weight 1).
  for (let i = 0; i < BIOME_COUNT; i++) out[i] /= sum;
  return out;
}

/** Index (into BIOMES) of the dominant biome at a direction. */
export function dominantBiomeIndexXYZ(x: number, y: number, z: number): number {
  edgeDistances(x, y, z);
  let best = 0;
  for (let i = 1; i < BIOME_COUNT; i++) if (scratchEdge[i] < scratchEdge[best]) best = i;
  return best;
}

/** Dominant biome at unit direction `dir` (max blend weight). */
export function dominantBiome(dir: Vector3): BiomeId {
  return BIOMES[dominantBiomeIndexXYZ(dir.x, dir.y, dir.z)].id;
}
