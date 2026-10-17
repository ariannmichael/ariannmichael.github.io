// Small pure helpers for authoring districts. Districts are written in TOWN tile coordinates (easier
// to reason about one shared grid) and converted to district-local coordinates with `localize`.
//
// Grid conventions (verified by rasterising the .glb files top-down):
// - "North" is -Z, "east" is +X. `rot` turns counter-clockwise seen from above, so one quarter turn
//   maps the open side E -> N -> W -> S -> E.
// - City Kit Roads at rot 0: road-straight / road-crossing run along X (open E+W), road-bend opens
//   W+S, road-intersection (T) opens W+E+S, road-end / road-end-round open E only, road-crossroad
//   opens all four sides, and road-roundabout is 3x3 tiles centred on its origin with one exit per side.
// - Racing Kit at rot 0 runs along Z (open N+S). Multi-tile pieces grow towards -Z (roadStart,
//   roadStartPositions) or towards +X/-Z (roadCornerLarge: enters from S at its base cell and leaves
//   E from the cell at (+1, -1)). roadSplitSmall is a straight with an extra opening on E.
import { TILE, type Marker, type ModelRef, type Placement, type Rot } from "@/world/layout/types";
import { rotatedBounds } from "@/world/models";

export type Dir = "N" | "E" | "S" | "W";

type Extra = Omit<Placement, "model" | "x" | "z" | "rot">;

/** One placement. */
export function put(model: ModelRef, x: number, z: number, rot: Rot = 0, extra: Extra = {}): Placement {
  return { model, x, z, rot, ...extra };
}

/**
 * Place a model so the centre of its footprint lands on (x, z), whatever its origin. Racing Kit
 * props (trees, banner towers, flags, light posts) have their origin in a corner of the tile.
 */
export function centredAt(model: ModelRef, x: number, z: number, rot: Rot = 0, extra: Extra = {}): Placement {
  const { min, max } = rotatedBounds(model, rot);
  const cx = (min[0] + max[0]) / 2 / TILE;
  const cz = (min[2] + max[2]) / 2 / TILE;
  return put(model, round3(x - cx), round3(z - cz), rot, extra);
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** A flat decal (road, floor, driveway): always drive-through, regardless of its height. */
export function flat(model: ModelRef, x: number, z: number, rot: Rot = 0, extra: Extra = {}): Placement {
  return put(model, x, z, rot, { ...extra, collider: "none" });
}

/** Inclusive integer range, in either direction. */
export function range(from: number, to: number): number[] {
  const step = from <= to ? 1 : -1;
  const out: number[] = [];
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v);
  return out;
}

/** City straights from `from` to `to` (inclusive) along one axis. Along X = rot 0, along Z = rot 1. */
export function cityRun(axis: "x" | "z", fixed: number, from: number, to: number, skip: number[] = []): Placement[] {
  return range(from, to)
    .filter((v) => !skip.includes(v))
    .map((v) =>
      axis === "x" ? flat("city-roads/road-straight", v, fixed, 0) : flat("city-roads/road-straight", fixed, v, 1),
    );
}

/** Racing straights along one axis. Along Z = rot 0, along X = rot 1. */
export function raceRun(axis: "x" | "z", fixed: number, from: number, to: number, skip: number[] = []): Placement[] {
  return range(from, to)
    .filter((v) => !skip.includes(v))
    .map((v) =>
      axis === "z" ? flat("racing-kit/roadStraight", fixed, v, 0) : flat("racing-kit/roadStraight", v, fixed, 1),
    );
}

/** `count` copies of a model stepping by (dx, dz) tiles. */
export function row(
  model: ModelRef,
  start: { x: number; z: number },
  step: { x: number; z: number },
  count: number,
  rot: Rot = 0,
  extra: Extra = {},
): Placement[] {
  return Array.from({ length: count }, (_, i) => put(model, start.x + step.x * i, start.z + step.z * i, rot, extra));
}

/** Cycle through several models along a row (for varied tree lines and building rows). */
export function mixedRow(
  models: readonly ModelRef[],
  start: { x: number; z: number },
  step: { x: number; z: number },
  count: number,
  rot: Rot = 0,
  extra: Extra = {},
): Placement[] {
  return Array.from({ length: count }, (_, i) =>
    put(models[i % models.length], start.x + step.x * i, start.z + step.z * i, rot, extra),
  );
}

/** Convert town tile coordinates to district-local ones. */
export function localize<T extends { x: number; z: number }>(origin: { x: number; z: number }, items: readonly T[]): T[] {
  return items.map((it) => ({ ...it, x: it.x - origin.x, z: it.z - origin.z }));
}

/** A district authored in town coordinates: placements, markers and spawn are localized together. */
export function authored(
  origin: { x: number; z: number },
  town: { placements: Placement[]; markers: Marker[]; spawn: { x: number; z: number; rot: Rot } },
): { placements: Placement[]; markers: Marker[]; spawn: { x: number; z: number; rot: Rot } } {
  return {
    placements: localize(origin, town.placements),
    markers: localize(origin, town.markers),
    spawn: { ...town.spawn, x: town.spawn.x - origin.x, z: town.spawn.z - origin.z },
  };
}

// --- Road connectivity (used by the tests to prove that road pieces really join) ----------------

const TURN: Record<Dir, Dir> = { E: "N", N: "W", W: "S", S: "E" };
export const OPPOSITE: Record<Dir, Dir> = { N: "S", S: "N", E: "W", W: "E" };
export const STEP: Record<Dir, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/** Turn a direction by `rot` quarter turns counter-clockwise. */
export function turn(d: Dir, rot: Rot | undefined): Dir {
  let out = d;
  for (let i = 0; i < (rot ?? 0); i++) out = TURN[out];
  return out;
}

/** Rotate a tile offset by quarter turns (same maths as world/lib/placement rotateQuarter). */
export function rotateOffset(dx: number, dz: number, rot: Rot | undefined): [number, number] {
  switch (rot ?? 0) {
    case 1:
      return [dz, -dx];
    case 2:
      return [-dx, -dz];
    case 3:
      return [-dz, dx];
    default:
      return [dx, dz];
  }
}

/**
 * Cells a road piece covers at rot 0: offset from its origin cell and the sides of that cell that
 * open onto the NEXT tile. Cells of one multi-tile piece are connected to each other internally.
 */
type CellSpec = { dx: number; dz: number; open: Dir[] };

const ROAD_PIECES: Record<string, CellSpec[]> = {
  "city-roads/road-straight": [{ dx: 0, dz: 0, open: ["E", "W"] }],
  "city-roads/road-crossing": [{ dx: 0, dz: 0, open: ["E", "W"] }],
  "city-roads/road-bend": [{ dx: 0, dz: 0, open: ["W", "S"] }],
  "city-roads/road-intersection": [{ dx: 0, dz: 0, open: ["W", "E", "S"] }],
  "city-roads/road-crossroad": [{ dx: 0, dz: 0, open: ["N", "E", "S", "W"] }],
  "city-roads/road-end": [{ dx: 0, dz: 0, open: ["E"] }],
  "city-roads/road-end-round": [{ dx: 0, dz: 0, open: ["E"] }],
  "city-roads/road-roundabout": [
    { dx: -1, dz: -1, open: [] },
    { dx: 0, dz: -1, open: ["N"] },
    { dx: 1, dz: -1, open: [] },
    { dx: -1, dz: 0, open: ["W"] },
    { dx: 0, dz: 0, open: [] },
    { dx: 1, dz: 0, open: ["E"] },
    { dx: -1, dz: 1, open: [] },
    { dx: 0, dz: 1, open: ["S"] },
    { dx: 1, dz: 1, open: [] },
  ],
  "racing-kit/roadStraight": [{ dx: 0, dz: 0, open: ["N", "S"] }],
  "racing-kit/roadSplitSmall": [{ dx: 0, dz: 0, open: ["N", "S", "E"] }],
  "racing-kit/roadStart": [
    { dx: 0, dz: 0, open: ["S"] },
    { dx: 0, dz: -1, open: ["N"] },
  ],
  "racing-kit/roadStartPositions": [
    { dx: 0, dz: 0, open: ["S"] },
    { dx: 0, dz: -1, open: ["N"] },
  ],
  "racing-kit/roadCornerLarge": [
    { dx: 0, dz: 0, open: ["S"] },
    { dx: 1, dz: 0, open: [] },
    { dx: 0, dz: -1, open: [] },
    { dx: 1, dz: -1, open: ["E"] },
  ],
};

export interface RoadCell {
  x: number;
  z: number;
  open: Set<Dir>;
  model: string;
}

export function isRoadPiece(model: string): boolean {
  return Object.prototype.hasOwnProperty.call(ROAD_PIECES, model);
}

/** Town-grid cells covered by a road placement (placement already in town coordinates). */
export function roadCells(p: Pick<Placement, "model" | "x" | "z" | "rot">): RoadCell[] {
  const spec = ROAD_PIECES[p.model];
  if (!spec) return [];
  return spec.map((c) => {
    const [dx, dz] = rotateOffset(c.dx, c.dz, p.rot);
    return { x: p.x + dx, z: p.z + dz, open: new Set(c.open.map((d) => turn(d, p.rot))), model: p.model };
  });
}

export interface RoadNetworkReport {
  /** Cells claimed by more than one piece */
  overlaps: string[];
  /** Open sides with no matching open side next door ("x,z:Dir") */
  danglingEnds: string[];
  /** Number of connected components (1 = everything joins) */
  components: number;
  cells: number;
}

/** Check that a set of road placements (town coordinates) forms one joined network. */
export function analyzeRoads(placements: readonly Pick<Placement, "model" | "x" | "z" | "rot">[]): RoadNetworkReport {
  const grid = new Map<string, RoadCell & { piece: number }>();
  const overlaps: string[] = [];
  const pieces = placements.filter((p) => isRoadPiece(p.model));
  pieces.forEach((p, piece) => {
    for (const c of roadCells(p)) {
      const key = `${c.x},${c.z}`;
      if (grid.has(key)) overlaps.push(key);
      grid.set(key, { ...c, piece });
    }
  });
  // Union-find over pieces: joined when an opening meets the opposite opening next door
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const danglingEnds: string[] = [];
  for (const [key, c] of grid) {
    for (const d of c.open) {
      const [sx, sz] = STEP[d];
      const n = grid.get(`${c.x + sx},${c.z + sz}`);
      if (!n || !n.open.has(OPPOSITE[d])) danglingEnds.push(`${key}:${d}`);
      else parent[find(c.piece)] = find(n.piece);
    }
  }
  const roots = new Set(pieces.map((_, i) => find(i)));
  return { overlaps, danglingEnds, components: roots.size, cells: grid.size };
}

/** Deterministic pseudo-random numbers (mulberry32) so scattered props are stable between builds. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scatter `count` copies of the given models inside a tile rectangle, with a little jitter. */
export function scatter(
  models: readonly ModelRef[],
  area: { x0: number; x1: number; z0: number; z1: number },
  count: number,
  seed: number,
  extra: Extra = {},
): Placement[] {
  const rnd = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const x = Math.round((area.x0 + rnd() * (area.x1 - area.x0)) * 4) / 4;
    const z = Math.round((area.z0 + rnd() * (area.z1 - area.z0)) * 4) / 4;
    return put(models[i % models.length], x, z, Math.floor(rnd() * 4) as Rot, extra);
  });
}
