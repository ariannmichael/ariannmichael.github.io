// The road network ("roadmap") linking every biome. Runtime side: the routed polylines are baked into
// roads.generated.ts by roadRoute.ts (`npm run roads`); this module answers "how far is the nearest
// road, and how high is its bed there?" for the terrain, and hands the polylines to world/roads.
// Pure data maths, no terrain import (terrain.ts imports this).

import { ROAD_DATA } from "./roads.generated";
import { PLANET_RADIUS } from "./config";
import type { BiomeId } from "./types";

const R = PLANET_RADIUS;

/** Half the paved width, metres. */
export const ROAD_HALF_WIDTH = 3.2;
/** The road bed is flat this far beyond the asphalt edge, then blends into the terrain over ROAD_BED_FEATHER. */
export const ROAD_BED_SHOULDER = 2.5;
export const ROAD_BED_FEATHER = 4;
/** Dirt verge (terrain colour) out to this distance from the centre line, metres. */
export const ROAD_VERGE = ROAD_HALF_WIDTH + ROAD_BED_SHOULDER + 1;
/** Spacing of the baked polyline points, metres. */
export const ROAD_STEP = 2;

const BED_FLAT = ROAD_HALF_WIDTH + ROAD_BED_SHOULDER;
const REACH = BED_FLAT + ROAD_BED_FEATHER;

/**
 * Which biomes are linked: one loop through all eight towns. The biome centres zigzag between the
 * two rings of a square antiprism, so each link joins nearest neighbours. Roads run between spawns.
 */
export const ROAD_LINKS: readonly [BiomeId, BiomeId][] = [
  ["home", "raceway"],
  ["raceway", "engineering"],
  ["engineering", "badlands"],
  ["badlands", "healthcare"],
  ["healthcare", "gamedev"],
  ["gamedev", "financial"],
  ["financial", "opensource"],
  ["opensource", "home"],
];

/** Baked road: unit-direction polyline (flat xyz, ROAD_STEP apart) and the bed height at each point. */
export interface RoadData {
  from: BiomeId;
  to: BiomeId;
  points: number[];
  heights: number[];
}

/** Bounding cap of a run of segments, for a cheap reject. */
interface Chunk {
  x: number;
  y: number;
  z: number;
  cos: number;
  first: number;
  last: number; // last segment index (inclusive)
}

export interface PreparedRoad {
  from: BiomeId;
  to: BiomeId;
  count: number;
  /** Unit directions, packed xyz */
  p: Float64Array;
  /** Bed height (metres above PLANET_RADIUS) per point */
  h: Float64Array;
  chunks: Chunk[];
  /** Total length, metres */
  length: number;
}

const CHUNK = 8;

export function prepareRoads(data: readonly RoadData[]): PreparedRoad[] {
  return data.map((d) => {
    const count = d.points.length / 3;
    const p = new Float64Array(d.points);
    for (let i = 0; i < count; i++) {
      const l = Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      p[i * 3] /= l;
      p[i * 3 + 1] /= l;
      p[i * 3 + 2] /= l;
    }
    const chunks: Chunk[] = [];
    for (let first = 0; first < count - 1; first += CHUNK) {
      const last = Math.min(first + CHUNK - 1, count - 2);
      let x = 0, y = 0, z = 0;
      for (let k = first; k <= last + 1; k++) {
        x += p[k * 3];
        y += p[k * 3 + 1];
        z += p[k * 3 + 2];
      }
      const l = Math.hypot(x, y, z);
      x /= l; y /= l; z /= l;
      let angle = 0;
      for (let k = first; k <= last + 1; k++) {
        const c = x * p[k * 3] + y * p[k * 3 + 1] + z * p[k * 3 + 2];
        angle = Math.max(angle, Math.acos(Math.min(1, c)));
      }
      chunks.push({ x, y, z, cos: Math.cos(angle + REACH / R), first, last });
    }
    let length = 0;
    for (let i = 0; i < count - 1; i++) {
      const dx = p[i * 3 + 3] - p[i * 3], dy = p[i * 3 + 4] - p[i * 3 + 1], dz = p[i * 3 + 5] - p[i * 3 + 2];
      length += Math.hypot(dx, dy, dz) * R;
    }
    return { from: d.from, to: d.to, count, p, h: new Float64Array(d.heights), chunks, length };
  });
}

let defaultRoads: PreparedRoad[] | null = null;
/** The baked network, prepared once. */
export function getRoads(): PreparedRoad[] {
  if (!defaultRoads) defaultRoads = prepareRoads(ROAD_DATA);
  return defaultRoads;
}

/** Nearest-road result; `dist` is Infinity when no road is within reach. */
export interface RoadHit {
  dist: number;
  /** Bed height at the nearest point */
  target: number;
  road: number;
  /** Segment index and the fraction along it */
  seg: number;
  t: number;
}

/** Nearest point of road `r` to unit direction (x, y, z), if within the bed's reach. Fills `out`. */
function nearestOnRoad(x: number, y: number, z: number, roads: readonly PreparedRoad[], r: number, out: RoadHit): RoadHit {
  out.dist = Infinity;
  const { p, h, chunks } = roads[r];
  for (let c = 0; c < chunks.length; c++) {
    const ch = chunks[c];
    if (x * ch.x + y * ch.y + z * ch.z < ch.cos) continue;
    for (let i = ch.first; i <= ch.last; i++) {
      const o = i * 3;
      const ax = p[o], ay = p[o + 1], az = p[o + 2];
      const ex = p[o + 3] - ax, ey = p[o + 4] - ay, ez = p[o + 5] - az;
      const ee = ex * ex + ey * ey + ez * ez;
      let t = ((x - ax) * ex + (y - ay) * ey + (z - az) * ez) / ee;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - (ax + ex * t), dy = y - (ay + ey * t), dz = z - (az + ez * t);
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) * R; // chord ≈ arc at these scales
      if (d < out.dist) {
        out.dist = d;
        out.target = h[i] + (h[i + 1] - h[i]) * t;
        out.road = r;
        out.seg = i;
        out.t = t;
      }
    }
  }
  return out;
}

const one: RoadHit = { dist: Infinity, target: 0, road: -1, seg: 0, t: 0 };

/** Nearest road centre line to unit direction (x, y, z), within the bed's reach. Fills `out`. */
export function nearestRoadXYZ(
  x: number,
  y: number,
  z: number,
  roads: readonly PreparedRoad[],
  out: RoadHit,
): RoadHit {
  out.dist = Infinity;
  for (let r = 0; r < roads.length; r++) {
    nearestOnRoad(x, y, z, roads, r, one);
    if (one.dist < out.dist) Object.assign(out, one);
  }
  return out;
}

const hit: RoadHit = { dist: Infinity, target: 0, road: -1, seg: 0, t: 0 };

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Road bed at a point: `weight` 1 on the flat bed, easing to 0 at its reach, and the bed height. */
export interface RoadBed {
  weight: number;
  target: number;
}

/**
 * Fills `out` with the road bed at a point (weight 0 away from roads). Where roads meet (they share
 * their town hubs) the beds are blended by weight, so a junction has no step between two beds.
 */
export function roadBedXYZ(x: number, y: number, z: number, roads: readonly PreparedRoad[], out: RoadBed): RoadBed {
  out.weight = 0;
  let sum = 0;
  let wsum = 0;
  for (let r = 0; r < roads.length; r++) {
    nearestOnRoad(x, y, z, roads, r, one);
    if (one.dist >= REACH) continue;
    // Soft weights (never exactly 0 inside the reach) keep the blend continuous between beds
    const w = 1 - smoothstep(BED_FLAT, REACH, one.dist);
    const soft = w + 1e-3 * (REACH - one.dist);
    sum += one.target * soft;
    wsum += soft;
    if (w > out.weight) out.weight = w;
  }
  if (wsum > 0) out.target = sum / wsum;
  return out;
}

const bed: RoadBed = { weight: 0, target: 0 };

/** Height `h` with the road bed applied: flat at the bed height near a road, blending out past it. */
export function applyRoadBed(x: number, y: number, z: number, h: number, roads: readonly PreparedRoad[]): number {
  roadBedXYZ(x, y, z, roads, bed);
  return bed.weight > 0 ? h + (bed.target - h) * bed.weight : h;
}

/** 1 on the road and its verge, 0 away from roads (for the dirt colour under/around the asphalt). */
export function roadVergeXYZ(x: number, y: number, z: number, roads: readonly PreparedRoad[]): number {
  if (roads.length === 0) return 0;
  nearestRoadXYZ(x, y, z, roads, hit);
  return 1 - smoothstep(ROAD_VERGE - 1, ROAD_VERGE + 1, hit.dist);
}
