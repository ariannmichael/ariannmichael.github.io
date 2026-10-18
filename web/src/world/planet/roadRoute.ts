// Offline road router: finds a drivable path between the spawns of every ROAD_LINKS pair and bakes
// it into roads.generated.ts (`npm run roads`; the runtime never routes). Pure maths over the
// layouts and the pad-flattened terrain (without road beds, so routing never depends on itself).
//
// Per link: a strip grid (2 m cells) around the great circle between the two spawns; cells inside
// any placement's footprint (+ the road bed and a margin) or the parking rings are blocked; A* with
// a slope penalty finds a path; string pulling + Chaikin turn the staircase into a smooth road; the
// bed height is the terrain along the road, low-pass filtered so the ride is smooth.

import { PLANET_LAYOUTS } from "@/world/layout/planet";
import { PLANET_RADIUS } from "./config";
import { layoutObstacles, type Obstacle } from "./obstacles";
import { latLonToDir } from "./sphere";
import { groundHeightNoRoadsXYZ } from "./terrain";
import { ROAD_BED_SHOULDER, ROAD_HALF_WIDTH, ROAD_LINKS, ROAD_STEP, type RoadData } from "./roads";
import type { BiomeId, LatLon } from "./types";

const R = PLANET_RADIUS;
const CELL = 2;
/** Strip half-width around the spawn-to-spawn great circle, and overshoot past each spawn, metres */
const STRIP_HALF = 110;
const STRIP_OVERSHOOT = 40;
/** Free space between a footprint and the road centre line: the bed plus a margin, metres */
export const ROAD_CLEARANCE = ROAD_HALF_WIDTH + ROAD_BED_SHOULDER + 0.5;
/** Rise/run limits: A* refuses steeper steps; the smoothing keeps well under it */
const MAX_GRADE = 0.42;
const LOS_GRADE = 0.32;
/** Cost multiplier per grade² (0.2 grade → ~2× the cost of flat ground) */
const SLOPE_COST = 25;
/** Side slope (across the road) costs more than climbing: a flat bed across a bank needs a cut and a
 * fill, and where pads win (blend rings) the asphalt would tilt */
const CROSS_COST = 40;
/** Within this many metres past the clearance, nearby footprints make ground costlier (×(1 + CROWD_COST)) */
const CROWD_RANGE = 8;
const CROWD_COST = 3;
/** A road may end this far short of a walled-in spawn, metres */
const MAX_END_GAP = 40;
/** Steepest the finished bed may be (cut and fill past this) */
const BED_MAX_GRADE = 0.24;
/** Bed height low-pass: gaussian sigma in polyline points (ROAD_STEP apart) */
const BED_SIGMA = 2;

type V3 = [number, number, number];

const spawnOf = (id: BiomeId): LatLon => {
  const l = PLANET_LAYOUTS.find((x) => x.biome === id);
  if (!l) throw new Error(`No layout for biome "${id}"`);
  return l.spawn;
};

interface Strip {
  a: V3;
  t: V3;
  n: V3;
  length: number; // metres, spawn to spawn
  nu: number;
  nv: number;
  u0: number;
  v0: number;
}

function stripFor(from: LatLon, to: LatLon): Strip {
  const A = latLonToDir(from.lat, from.lon);
  const B = latLonToDir(to.lat, to.lon);
  const n = A.clone().cross(B).normalize();
  const t = n.clone().cross(A);
  const length = A.angleTo(B) * R;
  const u0 = -STRIP_OVERSHOOT;
  const v0 = -STRIP_HALF;
  return {
    a: [A.x, A.y, A.z],
    t: [t.x, t.y, t.z],
    n: [n.x, n.y, n.z],
    length,
    u0,
    v0,
    nu: Math.ceil((length + 2 * STRIP_OVERSHOOT) / CELL) + 1,
    nv: Math.ceil((2 * STRIP_HALF) / CELL) + 1,
  };
}

/** Unit direction at strip coordinates (u metres along, v metres to the left). */
function stripDir(s: Strip, u: number, v: number): V3 {
  const cu = Math.cos(u / R), su = Math.sin(u / R), cv = Math.cos(v / R), sv = Math.sin(v / R);
  return [0, 1, 2].map((k) => (s.a[k] * cu + s.t[k] * su) * cv + s.n[k] * sv) as V3;
}

class Heap {
  private items: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, key: number) {
    const { items, keys } = this;
    let i = items.length;
    items.push(item);
    keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      items[i] = items[p];
      keys[i] = keys[p];
      i = p;
    }
    items[i] = item;
    keys[i] = key;
  }
  pop(): number {
    const { items, keys } = this;
    const top = items[0];
    const item = items.pop()!;
    const key = keys.pop()!;
    if (items.length > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= items.length) break;
        const c = l + 1 < items.length && keys[l + 1] < keys[l] ? l + 1 : l;
        if (keys[c] >= key) break;
        items[i] = items[c];
        keys[i] = keys[c];
        i = c;
      }
      items[i] = item;
      keys[i] = key;
    }
    return top;
  }
}

/** Routes one link. Throws if the two spawns are not connected by drivable, clear ground. */
export function routeLink(from: BiomeId, to: BiomeId, obstacles: readonly Obstacle[]): RoadData {
  const s = stripFor(spawnOf(from), spawnOf(to));
  const N = s.nu * s.nv;
  const idx = (i: number, j: number) => i * s.nv + j;
  const blocked = new Uint8Array(N);
  const height = new Float64Array(N);

  // Obstacles anywhere near the strip
  const near = obstacles.filter((o) => {
    const left = Math.asin(o.x * s.n[0] + o.y * s.n[1] + o.z * s.n[2]) * R;
    return Math.abs(left) < STRIP_HALF + o.r + ROAD_CLEARANCE;
  });
  // `crowd` is 0 in open ground, rising to 1 at the clearance limit: the road prefers the middle of
  // gaps and keeps off building fronts and drive-in approaches
  const crowd = new Float64Array(N);
  const cosNear = near.map((o) => Math.cos((o.r + ROAD_CLEARANCE + CROWD_RANGE) / R));
  for (let i = 0; i < s.nu; i++) {
    for (let j = 0; j < s.nv; j++) {
      const d = stripDir(s, s.u0 + i * CELL, s.v0 + j * CELL);
      const k = idx(i, j);
      height[k] = groundHeightNoRoadsXYZ(d[0], d[1], d[2]);
      for (let o = 0; o < near.length; o++) {
        const ob = near[o];
        const c = d[0] * ob.x + d[1] * ob.y + d[2] * ob.z;
        if (c < cosNear[o]) continue;
        const gap = Math.acos(Math.min(1, c)) * R - ob.r - ROAD_CLEARANCE;
        if (gap <= 0) {
          blocked[k] = 1;
          break;
        }
        crowd[k] = Math.max(crowd[k], 1 - gap / CROWD_RANGE);
      }
    }
  }

  // Terrain gradient per cell (central differences; one-sided at the strip border)
  const gradU = new Float64Array(N);
  const gradV = new Float64Array(N);
  for (let i = 0; i < s.nu; i++) {
    for (let j = 0; j < s.nv; j++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(s.nu - 1, i + 1);
      const j0 = Math.max(0, j - 1), j1 = Math.min(s.nv - 1, j + 1);
      gradU[idx(i, j)] = (height[idx(i1, j)] - height[idx(i0, j)]) / ((i1 - i0) * CELL);
      gradV[idx(i, j)] = (height[idx(i, j1)] - height[idx(i, j0)]) / ((j1 - j0) * CELL);
    }
  }

  // Connected free areas (4-neighbour flood fill); the road must start in the big open one
  const area = new Int32Array(N).fill(-1);
  const areaSize: number[] = [];
  for (let k0 = 0; k0 < N; k0++) {
    if (blocked[k0] || area[k0] >= 0) continue;
    const id = areaSize.length;
    let size = 0;
    const stack = [k0];
    area[k0] = id;
    while (stack.length) {
      const k = stack.pop()!;
      size++;
      const i = Math.floor(k / s.nv);
      const j = k % s.nv;
      for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (ni < 0 || nj < 0 || ni >= s.nu || nj >= s.nv) continue;
        const nk = idx(ni, nj);
        if (blocked[nk] || area[nk] >= 0) continue;
        area[nk] = id;
        stack.push(nk);
      }
    }
    areaSize.push(size);
  }
  // The area that best reaches both spawns (smallest worse gap): the road must start and end in it
  const gapA = new Array(areaSize.length).fill(Infinity);
  const gapB = new Array(areaSize.length).fill(Infinity);
  for (let k = 0; k < N; k++) {
    const a = area[k];
    if (a < 0) continue;
    const u = s.u0 + Math.floor(k / s.nv) * CELL;
    const v = s.v0 + (k % s.nv) * CELL;
    gapA[a] = Math.min(gapA[a], Math.hypot(u, v));
    gapB[a] = Math.min(gapB[a], Math.hypot(u - s.length, v));
  }
  let mainArea = 0;
  for (let a = 1; a < areaSize.length; a++) {
    if (Math.max(gapA[a], gapB[a]) < Math.max(gapA[mainArea], gapB[mainArea])) mainArea = a;
  }

  // Nearest cell of that area to each spawn (spawns often sit on a plaza beside a building)
  const nearestFree = (u: number): number => {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < s.nu; i++) {
      for (let j = 0; j < s.nv; j++) {
        if (area[idx(i, j)] !== mainArea) continue;
        const d = Math.hypot(s.u0 + i * CELL - u, s.v0 + j * CELL);
        if (d < bestD) {
          bestD = d;
          best = idx(i, j);
        }
      }
    }
    return best;
  };
  const start = nearestFree(0);
  const goal = nearestFree(s.length);
  const gi = Math.floor(goal / s.nv);
  const gj = goal % s.nv;

  // A* over 8-neighbours
  const cost = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const heap = new Heap();
  cost[start] = 0;
  heap.push(start, 0);
  const STEPS = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  while (heap.size) {
    const k = heap.pop();
    if (k === goal) break;
    const i = Math.floor(k / s.nv);
    const j = k % s.nv;
    for (const [di, dj] of STEPS) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= s.nu || nj >= s.nv) continue;
      const nk = idx(ni, nj);
      if (blocked[nk]) continue;
      const len = CELL * Math.hypot(di, dj);
      const grade = Math.abs(height[nk] - height[k]) / len;
      if (grade > MAX_GRADE) continue;
      // Side slope: the terrain gradient across the direction of travel (banks, pad blend rings)
      const cross = Math.abs(gradU[nk] * dj - gradV[nk] * di) / Math.hypot(di, dj);
      const c =
        cost[k] +
        len * (1 + SLOPE_COST * grade * grade + CROSS_COST * cross * cross + CROWD_COST * crowd[nk] * crowd[nk]);
      if (c < cost[nk]) {
        cost[nk] = c;
        prev[nk] = k;
        heap.push(nk, c + CELL * Math.hypot(ni - gi, nj - gj));
      }
    }
  }
  // Spawn walled in (the badlands' jumps): end at the reachable cell nearest to it instead
  let end = goal;
  if (prev[goal] < 0 && goal !== start) {
    let bestD = Infinity;
    for (let k = 0; k < N; k++) {
      if (cost[k] === Infinity) continue;
      const d = Math.hypot(s.u0 + Math.floor(k / s.nv) * CELL - s.length, s.v0 + (k % s.nv) * CELL);
      if (d < bestD) {
        bestD = d;
        end = k;
      }
    }
    if (bestD > MAX_END_GAP) throw new Error(`No drivable route ${from} → ${to} (closest ${bestD.toFixed(0)} m)`);
  }

  // Cell path → (u, v) points
  const cells: number[] = [];
  for (let k = end; k >= 0; k = prev[k]) cells.push(k);
  cells.reverse();
  const uv = cells.map((k) => [s.u0 + Math.floor(k / s.nv) * CELL, s.v0 + (k % s.nv) * CELL] as [number, number]);

  // Bilinear terrain height and blocked test at any (u, v)
  const sample = (u: number, v: number): { h: number; free: boolean } => {
    const fi = (u - s.u0) / CELL;
    const fj = (v - s.v0) / CELL;
    const i = Math.max(0, Math.min(s.nu - 2, Math.floor(fi)));
    const j = Math.max(0, Math.min(s.nv - 2, Math.floor(fj)));
    const x = fi - i;
    const y = fj - j;
    const h =
      height[idx(i, j)] * (1 - x) * (1 - y) +
      height[idx(i + 1, j)] * x * (1 - y) +
      height[idx(i, j + 1)] * (1 - x) * y +
      height[idx(i + 1, j + 1)] * x * y;
    const free =
      !blocked[idx(i, j)] && !blocked[idx(i + 1, j)] && !blocked[idx(i, j + 1)] && !blocked[idx(i + 1, j + 1)];
    return { h, free };
  };
  const clearLine = (p: [number, number], q: [number, number]): boolean => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const steps = Math.max(1, Math.ceil(len));
    let last = sample(p[0], p[1]).h;
    for (let k = 1; k <= steps; k++) {
      const f = k / steps;
      const smp = sample(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f);
      if (!smp.free || Math.abs(smp.h - last) / (len / steps) > LOS_GRADE) return false;
      last = smp.h;
    }
    return true;
  };

  // String pulling: keep only the turning points the line of sight needs
  const pulled: [number, number][] = [uv[0]];
  let at = 0;
  while (at < uv.length - 1) {
    let next = at + 1;
    for (let k = uv.length - 1; k > at + 1; k--) {
      if (clearLine(uv[at], uv[k])) {
        next = k;
        break;
      }
    }
    pulled.push(uv[next]);
    at = next;
  }

  // Chaikin corner cutting (endpoints kept), corner by corner: a corner whose cut would clip an
  // obstacle or a steep bank stays as it is
  let line = pulled;
  for (let it = 0; it < 5; it++) {
    const out: [number, number][] = [line[0]];
    for (let k = 1; k < line.length - 1; k++) {
      const v = line[k];
      const p = line[k - 1];
      const n = line[k + 1];
      const q1: [number, number] = [v[0] + (p[0] - v[0]) * 0.25, v[1] + (p[1] - v[1]) * 0.25];
      const q2: [number, number] = [v[0] + (n[0] - v[0]) * 0.25, v[1] + (n[1] - v[1]) * 0.25];
      if (clearLine(out[out.length - 1], q1) && clearLine(q1, q2) && clearLine(q2, n)) out.push(q1, q2);
      else out.push(v);
    }
    out.push(line[line.length - 1]);
    line = out;
  }

  // Resample to even ROAD_STEP spacing, then relax: every point slides toward the midpoint of its
  // neighbours (straightens wiggles, opens tight turns) unless that would put it on blocked ground.
  let pts = resample(line);
  for (let round = 0; round < 4; round++) {
    for (let it = 0; it < 60; it++) {
      for (let k = 1; k < pts.length - 1; k++) {
        const p = pts[k];
        const mu = (pts[k - 1][0] + pts[k + 1][0]) / 2;
        const mv = (pts[k - 1][1] + pts[k + 1][1]) / 2;
        const nu = p[0] + (mu - p[0]) * 0.5;
        const nv = p[1] + (mv - p[1]) * 0.5;
        if (sample(nu, nv).free) pts[k] = [nu, nv];
      }
    }
    pts = resample(pts);
  }

  const dirs = pts.map(([u, v]) => stripDir(s, u, v));
  const raw = dirs.map((d) => groundHeightNoRoadsXYZ(d[0], d[1], d[2]));
  const bed = raw.map((_, i) => {
    let sum = 0;
    let wsum = 0;
    for (let k = -3 * BED_SIGMA; k <= 3 * BED_SIGMA; k++) {
      const h = raw[Math.max(0, Math.min(raw.length - 1, i + k))];
      const w = Math.exp((-k * k) / (2 * BED_SIGMA * BED_SIGMA));
      sum += h * w;
      wsum += w;
    }
    return sum / wsum;
  });

  // Cut and fill where the smoothed bed is still too steep: pull each steep pair together
  const run = dirs.map((d, i) => (i === 0 ? 0 : Math.hypot(d[0] - dirs[i - 1][0], d[1] - dirs[i - 1][1], d[2] - dirs[i - 1][2]) * R));
  for (let it = 0; it < 500; it++) {
    let steep = false;
    for (let i = 1; i < bed.length; i++) {
      const limit = BED_MAX_GRADE * run[i];
      const rise = bed[i] - bed[i - 1];
      if (Math.abs(rise) <= limit) continue;
      steep = true;
      const mid = (bed[i] + bed[i - 1]) / 2;
      const half = (Math.sign(rise) * limit) / 2;
      bed[i] = mid + half;
      bed[i - 1] = mid - half;
    }
    if (!steep) break;
  }

  return {
    from,
    to,
    points: dirs.flat().map((x) => Math.round(x * 1e6) / 1e6),
    heights: bed.map((h) => Math.round(h * 100) / 100),
  };
}

/** Points every ROAD_STEP metres along a polyline (last point kept). */
function resample(line: readonly [number, number][]): [number, number][] {
  const pts: [number, number][] = [line[0]];
  let carry = 0;
  for (let k = 0; k < line.length - 1; k++) {
    const p = line[k];
    const q = line[k + 1];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let d = ROAD_STEP - carry;
    while (d <= len) {
      pts.push([p[0] + ((q[0] - p[0]) * d) / len, p[1] + ((q[1] - p[1]) * d) / len]);
      d += ROAD_STEP;
    }
    carry = len - (d - ROAD_STEP);
  }
  const end = line[line.length - 1];
  const tail = pts[pts.length - 1];
  if (Math.hypot(end[0] - tail[0], end[1] - tail[1]) > 0.5) pts.push(end);
  else pts[pts.length - 1] = end;
  return pts;
}

/** Routes every link (a few seconds). */
export function routeAll(): RoadData[] {
  const obstacles = layoutObstacles();
  return ROAD_LINKS.map(([from, to]) => {
    try {
      return routeLink(from, to, obstacles);
    } catch {
      // A walled-in spawn (the badlands' jumps) can only be an end, never a start: route it backwards
      const back = routeLink(to, from, obstacles);
      const points: number[] = [];
      for (let i = back.points.length - 3; i >= 0; i -= 3) points.push(...back.points.slice(i, i + 3));
      return { from, to, points, heights: [...back.heights].reverse() };
    }
  });
}

/** roads.generated.ts source for `data`. */
export function formatRoadData(data: readonly RoadData[]): string {
  const body = data
    .map(
      (r) =>
        `  {\n    from: "${r.from}",\n    to: "${r.to}",\n    points: [${r.points.join(", ")}],\n    heights: [${r.heights.join(", ")}],\n  },`,
    )
    .join("\n");
  return `// GENERATED by roadRoute.ts (\`npm run roads\`). Do not edit by hand.\nimport type { RoadData } from "./roads";\n\nexport const ROAD_DATA: RoadData[] = [\n${body}\n];\n`;
}
