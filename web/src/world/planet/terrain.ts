// Planet terrain: a pure, deterministic height field over unit directions.
//
// Two layers:
// 1. `naturalHeight` / `analyticHeight`: the smooth noise field (biome shapes blended by
//    biomeField weights + a global undulation, then flat road beds (roads.ts) and flat pads,
//    pads winning). The mesh builder samples it at every icosphere vertex.
// 2. `terrainHeight`: the height of the *mesh* along a direction. It finds the icosphere triangle
//    under the direction and intersects the ray with that triangle's plane, so placements, the
//    camera and the vehicle agree exactly with what is rendered and with the Rapier trimesh.

import type { Vector3 } from "three";
import { PLANET_LAYOUTS } from "@/world/layout/planet";
import { BIOMES } from "./biomes";
import { BIOME_COUNT, biomeWeightsXYZ, dominantBiomeIndexXYZ } from "./biomeField";
import { PLANET_RADIUS } from "./config";
import { createNoise3D, fbm, ridgedFbm, smoothstep } from "./noise";
import { getRoads, roadBedXYZ, roadVergeXYZ, type PreparedRoad, type RoadBed } from "./roads";
import { gridDir, locateCell, type GridCell } from "./terrainGrid";
import type { BiomeId, FlatPad } from "./types";

const DEG = Math.PI / 180;
const R = PLANET_RADIUS;

const shapeNoise = createNoise3D(1009);
const globalNoise = createNoise3D(2017);

// ---------------------------------------------------------------------------------------------
// Biome shapes

/** Per-biome noise parameters derived from the biome table once. */
const SHAPE = BIOMES.map((b, i) => {
  const { amplitude, roughness } = b.terrain;
  return {
    base: b.terrain.base,
    amplitude,
    ridged: !!b.terrain.ridged,
    // Bigger amplitude → longer wavelength, so slope (≈ amplitude / wavelength) stays drivable.
    // Hills end up ~20–35 m across (half a wavelength).
    invWavelength: 1 / (36 + 3.2 * amplitude),
    // Slope from octave k scales with (2·gain)^k, so gain stays < 0.5 or fine octaves would make the
    // ~4 m mesh triangles steeper than the hills themselves.
    gain: 0.3 + 0.16 * roughness,
    // Each biome samples its own region of noise space so neighbours don't look alike.
    ox: i * 101.3,
    oy: i * -57.9,
    oz: i * 33.7,
  };
});

/** Terraces: flat ledges with steeper risers (mesas, jumps) for ridged biomes. */
const TERRACE_STEP = 3.5;
/** How terraced (0 = smooth, 1 = sharp steps). Risers get up to ~(1 + 2.75·mix)× steeper. */
const TERRACE_MIX = 0.25;
function terrace(h: number): number {
  const t = h / TERRACE_STEP;
  const k = Math.floor(t);
  const f = t - k;
  const s = smoothstep(0.3, 0.7, f);
    return TERRACE_STEP * (k + f + (s - f) * TERRACE_MIX);
}

function biomeShape(i: number, x: number, y: number, z: number): number {
  const s = SHAPE[i];
  const k = R * s.invWavelength;
  const px = x * k + s.ox;
  const py = y * k + s.oy;
  const pz = z * k + s.oz;
  if (s.ridged) {
    // Ridged fBm is in [0, 1] and mostly 0.1–0.7: centre it so the biome's `base` stays the mean.
    const r = ridgedFbm(shapeNoise, px, py, pz, 3, 2, s.gain, 0.3);
    return terrace(s.base + s.amplitude * (r - 0.35) * 1.3);
  }
  return s.base + s.amplitude * fbm(shapeNoise, px, py, pz, 3, 2, s.gain);
}

// ---------------------------------------------------------------------------------------------
// Natural (pad-free) height

const weightScratch = new Float32Array(BIOME_COUNT);

/** Noise height without road beds or pads. */
function baseHeightXYZ(x: number, y: number, z: number): number {
  // Planet-scale swell (~150 m features) so the horizon rolls.
  let h = 4 * fbm(globalNoise, x * 1.1, y * 1.1, z * 1.1, 3, 2, 0.45);
  const w = biomeWeightsXYZ(x, y, z, weightScratch);
  for (let i = 0; i < BIOME_COUNT; i++) {
    if (w[i] > 1e-4) h += w[i] * biomeShape(i, x, y, z);
  }
  return h;
}

/** Smooth noise height (metres above PLANET_RADIUS) without flat pads or road beds. Unit direction input. */
export function naturalHeightXYZ(x: number, y: number, z: number): number {
  return baseHeightXYZ(x, y, z);
}

// ---------------------------------------------------------------------------------------------
// Flat pads

/** A FlatPad resolved to a unit direction and an absolute target height. */
export interface PreparedPad {
  x: number; y: number; z: number;
  radius: number;
  blend: number;
  target: number;
  /** cos of the outer angular radius, for a cheap reject */
  cosOuter: number;
}

/** Resolves pads once: direction + flatten height (natural height at the centre + `height`). */
export function preparePads(pads: readonly FlatPad[]): PreparedPad[] {
  return pads.map((p) => {
    const la = p.lat * DEG;
    const lo = p.lon * DEG;
    const x = Math.cos(la) * Math.sin(lo);
    const y = Math.sin(la);
    const z = Math.cos(la) * Math.cos(lo);
    const blend = p.blend ?? 8;
    return {
      x, y, z,
      radius: p.radius,
      blend,
      target: naturalHeightXYZ(x, y, z) + (p.height ?? 0),
      cosOuter: Math.cos(Math.min(Math.PI, (p.radius + blend) / R)),
    };
  });
}

/** Applies pads (in order; later pads win where they overlap) to height `h` at a direction. */
export function applyPads(x: number, y: number, z: number, h: number, pads: readonly PreparedPad[]): number {
  for (let k = 0; k < pads.length; k++) {
    const p = pads[k];
    const c = x * p.x + y * p.y + z * p.z;
    if (c < p.cosOuter) continue;
    const dist = Math.acos(c > 1 ? 1 : c) * R;
    const t = smoothstep(p.radius, p.radius + p.blend, dist);
    h = p.target + (h - p.target) * t;
  }
  return h;
}

/**
 * 1 away from every pad, fading to 0 inside one (over its blend ring). The dirt verge along roads is
 * multiplied by it, so plazas and lawns keep their own colour where a road crosses them.
 */
export function padFadeXYZ(x: number, y: number, z: number, pads: readonly PreparedPad[]): number {
  let f = 1;
  for (let k = 0; k < pads.length; k++) {
    const p = pads[k];
    const c = x * p.x + y * p.y + z * p.z;
    if (c < p.cosOuter) continue;
    f *= smoothstep(p.radius, p.radius + p.blend, Math.acos(c > 1 ? 1 : c) * R);
    if (f === 0) return 0;
  }
  return f;
}

/** Dirt verge along the roads as drawn on the terrain: 1 under/beside a road, faded out inside pads. */
export function vergeMaskXYZ(
  x: number,
  y: number,
  z: number,
  pads: readonly PreparedPad[] = getDefaultPads(),
  roads: readonly PreparedRoad[] = getRoads(),
): number {
  const m = roadVergeXYZ(x, y, z, roads);
  return m > 0 ? m * padFadeXYZ(x, y, z, pads) : 0;
}

// Resolved lazily on first use rather than at import: biome layout modules may import frame.ts
// (which imports this file), and resolving at import time would read PLANET_LAYOUTS mid-cycle.
let defaultPads: PreparedPad[] | null = null;
/** Pads from every PLANET_LAYOUTS entry, resolved once. */
export function getDefaultPads(): PreparedPad[] {
  if (!defaultPads) defaultPads = preparePads(PLANET_LAYOUTS.flatMap((l) => l.pads));
  return defaultPads;
}

/** Ground height with pads but no road beds: what roadRoute.ts routes and grades the roads over. */
export function groundHeightNoRoadsXYZ(
  x: number,
  y: number,
  z: number,
  pads: readonly PreparedPad[] = getDefaultPads(),
): number {
  return applyPads(x, y, z, baseHeightXYZ(x, y, z), pads);
}

/** Pads keep their flat cores; across the outer part of a blend ring (fade above 1/3) the road wins */
const ROAD_OVER_RING = 3;
const bed: RoadBed = { weight: 0, target: 0 };

/**
 * Smooth field height including road beds and pads: what every mesh vertex is set to. Pads win in
 * their flat cores, but a road levels any blend ring it crosses, so the asphalt never tilts sideways
 * down a pad's rim (the bed already follows the pads' heights, so cores and road meet smoothly).
 */
export function analyticHeightXYZ(
  x: number,
  y: number,
  z: number,
  pads: readonly PreparedPad[] = getDefaultPads(),
  roads: readonly PreparedRoad[] = getRoads(),
): number {
  const base = baseHeightXYZ(x, y, z);
  roadBedXYZ(x, y, z, roads, bed);
  if (bed.weight === 0) return applyPads(x, y, z, base, pads);
  const h = applyPads(x, y, z, base + (bed.target - base) * bed.weight, pads);
  const w = bed.weight * Math.min(1, ROAD_OVER_RING * padFadeXYZ(x, y, z, pads));
  return h + (bed.target - h) * w;
}

// ---------------------------------------------------------------------------------------------
// Public API (contract)

const cell: GridCell = { face: 0, i0: 0, j0: 0, i1: 0, j1: 0, i2: 0, j2: 0 };
const corner = new Float64Array(9);

/**
 * Exact mesh surface height along (x, y, z): finds the icosphere triangle under the direction and
 * intersects the ray with it. `pads` defaults to the layouts' pads (inject for tests).
 */
export function meshHeightXYZ(
  x: number,
  y: number,
  z: number,
  pads: readonly PreparedPad[] = getDefaultPads(),
): number {
  const l = Math.hypot(x, y, z);
  x /= l; y /= l; z /= l;
  locateCell(x, y, z, cell);
  gridDir(cell.face, cell.i0, cell.j0, corner, 0);
  gridDir(cell.face, cell.i1, cell.j1, corner, 3);
  gridDir(cell.face, cell.i2, cell.j2, corner, 6);
  for (let k = 0; k < 9; k += 3) {
    const r = R + analyticHeightXYZ(corner[k], corner[k + 1], corner[k + 2], pads);
    corner[k] *= r;
    corner[k + 1] *= r;
    corner[k + 2] *= r;
  }
  // Plane through the three displaced corners; ray t·dir hits it at t = (n·V0) / (n·dir).
  const e1x = corner[3] - corner[0], e1y = corner[4] - corner[1], e1z = corner[5] - corner[2];
  const e2x = corner[6] - corner[0], e2y = corner[7] - corner[1], e2z = corner[8] - corner[2];
  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  const t = (nx * corner[0] + ny * corner[1] + nz * corner[2]) / (nx * x + ny * y + nz * z);
  return t - R;
}

/**
 * Terrain height in metres above PLANET_RADIUS along unit direction `dir`.
 * Exactly the rendered mesh / physics trimesh surface (flat triangles between vertices).
 */
export function terrainHeight(dir: Vector3): number {
  return meshHeightXYZ(dir.x, dir.y, dir.z);
}

/** Dominant biome at unit direction `dir`. */
export function biomeAt(dir: Vector3): BiomeId {
  return BIOMES[dominantBiomeIndexXYZ(dir.x, dir.y, dir.z)].id;
}
