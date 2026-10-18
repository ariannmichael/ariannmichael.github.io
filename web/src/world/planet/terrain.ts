// Planet terrain: a pure, deterministic height field over unit directions.
//
// Two layers:
// 1. `naturalHeight` / `analyticHeight`: the smooth noise field (biome shapes blended by
//    biomeField weights + a global undulation + dirt-track grooves + flat pads). The mesh builder
//    samples it at every icosphere vertex.
// 2. `terrainHeight`: the height of the *mesh* along a direction. It finds the icosphere triangle
//    under the direction and intersects the ray with that triangle's plane, so placements, the
//    camera and the vehicle agree exactly with what is rendered and with the Rapier trimesh.

import type { Vector3 } from "three";
import { PLANET_LAYOUTS } from "@/world/layout/planet";
import { BIOMES } from "./biomes";
import {
  BIOME_COUNT,
  biomeCenter,
  biomeWeightsXYZ,
  dominantBiomeIndexXYZ,
} from "./biomeField";
import { PLANET_RADIUS } from "./config";
import { createNoise3D, fbm, ridgedFbm, smoothstep } from "./noise";
import { gridDir, locateCell, type GridCell } from "./terrainGrid";
import type { BiomeId, FlatPad } from "./types";

const DEG = Math.PI / 180;
const R = PLANET_RADIUS;

const shapeNoise = createNoise3D(1009);
const globalNoise = createNoise3D(2017);
const trackNoise = createNoise3D(3023);

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
// Dirt tracks: meandering trails along great-circle arcs between neighbouring biome centres.

const TRACK_HALF_WIDTH = 2.6; // metres of full dirt either side of the centre line
const TRACK_FEATHER = 1.8;
const TRACK_MEANDER = 9; // metres of sideways wander
const TRACK_GROOVE = 0.35; // how far tracks are worn into the ground

interface Arc {
  ax: number; ay: number; az: number;
  // n = unit normal of the great circle; t = n × a (tangent at a, pointing toward b)
  nx: number; ny: number; nz: number;
  tx: number; ty: number; tz: number;
  length: number; // radians
}

const ARCS: Arc[] = (() => {
  // Connect each biome to its two nearest neighbours.
  const pairs = new Set<string>();
  for (let i = 0; i < BIOME_COUNT; i++) {
    const ci = biomeCenter(i);
    const others = [];
    for (let j = 0; j < BIOME_COUNT; j++) {
      if (j === i) continue;
      const cj = biomeCenter(j);
      others.push({ j, d: Math.acos(ci[0] * cj[0] + ci[1] * cj[1] + ci[2] * cj[2]) });
    }
    others.sort((p, q) => p.d - q.d);
    for (const { j } of others.slice(0, 2)) pairs.add(i < j ? `${i}-${j}` : `${j}-${i}`);
  }
  return [...pairs].sort().map((key) => {
    const [i, j] = key.split("-").map(Number);
    const [ax, ay, az] = biomeCenter(i);
    const [bx, by, bz] = biomeCenter(j);
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const nl = Math.hypot(nx, ny, nz);
    nx /= nl; ny /= nl; nz /= nl;
    return {
      ax, ay, az, nx, ny, nz,
      tx: ny * az - nz * ay,
      ty: nz * ax - nx * az,
      tz: nx * ay - ny * ax,
      length: Math.acos(Math.min(1, ax * bx + ay * by + az * bz)),
    };
  });
})();

const TRACK_REACH = (TRACK_HALF_WIDTH + TRACK_FEATHER + TRACK_MEANDER) / R; // radians

/** trackMask for raw unit-direction components. */
export function trackMaskXYZ(x: number, y: number, z: number): number {
  let best = 0;
  for (let k = 0; k < ARCS.length; k++) {
    const a = ARCS[k];
    const side = x * a.nx + y * a.ny + z * a.nz; // sin(angle off the great circle)
    if (side > TRACK_REACH || side < -TRACK_REACH) continue;
    const along = Math.atan2(x * a.tx + y * a.ty + z * a.tz, x * a.ax + y * a.ay + z * a.az);
    if (along < 0 || along > a.length) continue;
    // Taper the wander to zero at both ends so trails arrive at the biome centres.
    const taper = Math.sin((Math.PI * along) / a.length);
    const wander = TRACK_MEANDER * taper * fbm(trackNoise, x * 9 + k * 13.1, y * 9, z * 9, 2);
    const lateral = Math.abs(Math.asin(side) * R + wander);
    const m = 1 - smoothstep(TRACK_HALF_WIDTH, TRACK_HALF_WIDTH + TRACK_FEATHER, lateral);
    if (m > best) best = m;
  }
  return best;
}

/** How much of a dirt trail is at unit direction `dir` (0 = none, 1 = centre of the trail). */
export function trackMask(dir: Vector3): number {
  return trackMaskXYZ(dir.x, dir.y, dir.z);
}

// ---------------------------------------------------------------------------------------------
// Natural (pad-free) height

const weightScratch = new Float32Array(BIOME_COUNT);

/** Smooth noise height (metres above PLANET_RADIUS) without flat pads. Unit direction input. */
export function naturalHeightXYZ(x: number, y: number, z: number): number {
  // Planet-scale swell (~150 m features) so the horizon rolls.
  let h = 4 * fbm(globalNoise, x * 1.1, y * 1.1, z * 1.1, 3, 2, 0.45);
  const w = biomeWeightsXYZ(x, y, z, weightScratch);
  for (let i = 0; i < BIOME_COUNT; i++) {
    if (w[i] > 1e-4) h += w[i] * biomeShape(i, x, y, z);
  }
  h -= TRACK_GROOVE * trackMaskXYZ(x, y, z);
  return h;
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

// Resolved lazily on first use rather than at import: biome layout modules may import frame.ts
// (which imports this file), and resolving at import time would read PLANET_LAYOUTS mid-cycle.
let defaultPads: PreparedPad[] | null = null;
/** Pads from every PLANET_LAYOUTS entry, resolved once. */
export function getDefaultPads(): PreparedPad[] {
  if (!defaultPads) defaultPads = preparePads(PLANET_LAYOUTS.flatMap((l) => l.pads));
  return defaultPads;
}

/** Smooth field height including pads: what every mesh vertex is set to. */
export function analyticHeightXYZ(
  x: number,
  y: number,
  z: number,
  pads: readonly PreparedPad[] = getDefaultPads(),
): number {
  return applyPads(x, y, z, naturalHeightXYZ(x, y, z), pads);
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
