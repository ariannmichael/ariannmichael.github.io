// Shared layout checks for biome agent A's tests (home, engineering, raceway). Test-only module.
import { expect } from "vitest";
import { Quaternion, Vector3 } from "three";
import { games } from "@/content/games";
import { jobs } from "@/content/jobs";
import { getModel, hasModel } from "@/world/models";
import { markerSensorBox, planetColliderBox, type OrientedBox } from "@/world/lib/planetPlacement";
import { resolveCollider } from "@/world/lib/placement";
import { BIOMES } from "@/world/planet/biomes";
import { angleBetween, degToMetres, headingAt, latLonToDir, surfaceFrame, surfaceRadius } from "@/world/planet/frame";
import { PLANET_RADIUS } from "@/world/planet/config";
import { biomeAt, groundHeightNoRoadsXYZ, preparePads } from "@/world/planet/terrain";
import type { BiomeLayout, FlatPad, LatLon } from "@/world/planet/types";
import { grid as gridAt } from "../author";

export const BUDGET = { placements: 220, models: 40, characters: 8, dynamic: 12 };

/** Kind a marker id must have: job/game from content, or the special ids. */
export function expectedKind(id: string): string | undefined {
  if (id === "about" || id === "contact" || id === "cv") return id;
  if (jobs.some((j) => j.id === id)) return "job";
  if (games.some((g) => g.id === id)) return "game";
  return undefined;
}

function inside(box: OrientedBox, p: Vector3, margin = 0): boolean {
  const q = new Quaternion(...box.quaternion).invert();
  const d = p.clone().sub(new Vector3(...box.center)).applyQuaternion(q);
  return (
    Math.abs(d.x) < box.halfExtents[0] + margin &&
    Math.abs(d.y) < box.halfExtents[1] + margin &&
    Math.abs(d.z) < box.halfExtents[2] + margin
  );
}

export function solidBoxes(layout: BiomeLayout): { model: string; box: OrientedBox }[] {
  return layout.placements
    .filter((p) => p.body !== "dynamic")
    .filter((p) => resolveCollider(p, getModel(p.model)) === "box")
    .map((p) => ({ model: p.model, box: planetColliderBox(p, getModel(p.model)) }));
}

/** World point `h` metres above the terrain at lat/lon, plus `ahead` metres along `yaw`. */
function pointAt(at: LatLon, h: number, yaw = 0, ahead = 0): Vector3 {
  const dir = latLonToDir(at.lat, at.lon);
  const frame = surfaceFrame(dir);
  const p = dir.clone().multiplyScalar(surfaceRadius(dir) + h);
  if (ahead) {
    p.addScaledVector(headingAt(frame, yaw), ahead);
    // re-project onto the surface (+h) at the new direction
    const d2 = p.clone().normalize();
    return d2.multiplyScalar(surfaceRadius(d2) + h);
  }
  return p;
}

export function checkLayout(layout: BiomeLayout, ids: string[]) {
  const biome = BIOMES.find((b) => b.id === layout.biome)!;

  // Every model exists
  const missing = layout.placements.filter((p) => !hasModel(p.model)).map((p) => p.model);
  expect(missing).toEqual([]);

  // Markers: exactly the expected ids, valid kinds
  expect(layout.markers.map((m) => m.id).sort()).toEqual([...ids].sort());
  for (const m of layout.markers) {
    expect(expectedKind(m.id), m.id).toBe(m.kind);
    if (m.label) expect(m.label.length, m.id).toBeLessThanOrEqual(26);
  }

  // Biome agreement at spawn and markers; core within 0.8 × radius
  for (const p of [layout.spawn, ...layout.markers]) {
    expect(biomeAt(latLonToDir(p.lat, p.lon)), JSON.stringify(p)).toBe(layout.biome);
    expect(angleBetween(p, biome.center)).toBeLessThan(0.8 * biome.radiusDeg);
  }
  // Everything within the biome radius
  for (const p of [...layout.placements, ...layout.pads]) {
    expect(angleBetween(p, biome.center), JSON.stringify(p)).toBeLessThan(biome.radiusDeg);
  }

  // Markers at least 8 m apart
  for (let i = 0; i < layout.markers.length; i++) {
    for (let j = i + 1; j < layout.markers.length; j++) {
      const d = degToMetres(angleBetween(layout.markers[i], layout.markers[j]));
      expect(d, `${layout.markers[i].id} ↔ ${layout.markers[j].id}`).toBeGreaterThanOrEqual(8);
    }
  }

  // No marker sensor centre / spawn inside a solid collider; the way ahead of the spawn is clear
  const boxes = solidBoxes(layout);
  for (const m of layout.markers) {
    const c = new Vector3(...markerSensorBox(m, 6, 4).center);
    const hit = boxes.filter((b) => inside(b.box, c)).map((b) => b.model);
    expect(hit, `marker ${m.id}`).toEqual([]);
  }
  for (const ahead of [0, 3, 6, 9, 12]) {
    const p = pointAt(layout.spawn, 1, layout.spawn.yaw, ahead);
    const hit = boxes.filter((b) => inside(b.box, p, 1.3)).map((b) => b.model);
    expect(hit, `spawn +${ahead} m`).toEqual([]);
  }

  // Budgets
  expect(layout.placements.length).toBeLessThanOrEqual(BUDGET.placements);
  expect(new Set(layout.placements.map((p) => p.model)).size).toBeLessThanOrEqual(BUDGET.models);
  expect(layout.placements.filter((p) => p.model.startsWith("mini-characters/")).length).toBeLessThanOrEqual(
    BUDGET.characters,
  );
  expect(layout.placements.filter((p) => p.body === "dynamic").length).toBeLessThanOrEqual(BUDGET.dynamic);

  // Pads are big enough for the mesh
  for (const pad of layout.pads) expect(pad.radius).toBeGreaterThanOrEqual(2.5);
}

/** True when a point `h` m above the ground at lat/lon is inside any solid collider (for interior checks). */
export function blockedAt(layout: BiomeLayout, at: LatLon, h = 1.1, margin = 1.2): string[] {
  const p = pointAt(at, h);
  return solidBoxes(layout)
    .filter((b) => inside(b.box, p, margin))
    .map((b) => b.model);
}

// --- Small-planet town checks -------------------------------------------------------------------

/** Town budget (mirrors budget.test.ts): footprints + markers within 40 m, pads with blend within 46 m. */
export const TOWN = { radius: 40, padReach: 46 };
/** Lanes kept open from the spawn toward the road bearings: half-width, metres */
export const LANE_HALF = 6;
/** Pieces lower than this are driven over (as in planet/obstacles.ts) */
const FLAT_PIECE = 0.6;

function centerOf(layout: BiomeLayout): LatLon {
  return BIOMES.find((b) => b.id === layout.biome)!.center;
}

/** Azimuthal-equidistant (north, east) metres of `p` around `center` (matches the grid() at() frame closely). */
export function localNE(center: LatLon, p: LatLon): [number, number] {
  const c = latLonToDir(center.lat, center.lon);
  const d = latLonToDir(p.lat, p.lon);
  const f = surfaceFrame(c);
  const t = d.clone().addScaledVector(c, -c.dot(d));
  const len = t.length();
  if (len < 1e-12) return [0, 0];
  const k = (c.angleTo(d) * PLANET_RADIUS) / len;
  return [t.dot(f.north) * k, t.dot(f.east) * k];
}

interface Obstacle {
  what: string;
  n: number;
  e: number;
  r: number;
}

/** Footprints the road router keeps clear of (same rules as planet/obstacles.ts), in local metres. */
export function townObstacles(layout: BiomeLayout): Obstacle[] {
  const center = centerOf(layout);
  const out: Obstacle[] = [];
  for (const p of layout.placements) {
    const { min, max } = getModel(p.model);
    const s = p.scale ?? 1;
    if (p.body === "dynamic" || (max[1] - min[1]) * s < FLAT_PIECE) continue;
    const up = latLonToDir(p.lat, p.lon);
    const fwd = headingAt(surfaceFrame(up), p.yaw ?? 0);
    const right = up.clone().cross(fwd);
    const R = PLANET_RADIUS;
    const c = up
      .clone()
      .addScaledVector(fwd, ((min[2] + max[2]) / 2) * s / R)
      .addScaledVector(right, ((min[0] + max[0]) / 2) * s / R)
      .normalize();
    const lat = (Math.asin(c.y) * 180) / Math.PI;
    const lon = (Math.atan2(c.x, c.z) * 180) / Math.PI;
    const [n, e] = localNE(center, { lat, lon });
    out.push({ what: p.model, n, e, r: (Math.hypot(max[0] - min[0], max[2] - min[2]) / 2) * s });
  }
  for (const p of layout.pads) {
    if (Math.abs(p.height ?? 0) < 1.5 || p.radius >= 12) continue;
    const [n, e] = localNE(center, p);
    out.push({ what: `pad r=${p.radius}`, n, e, r: p.radius + (p.blend ?? 8) / 2 });
  }
  for (const m of layout.markers) {
    const [n, e] = localNE(center, m);
    out.push({ what: `marker ${m.id}`, n, e, r: 4 });
  }
  return out;
}

/**
 * Lanes from the spawn toward each compass bearing (degrees clockwise from north) out to the town
 * edge: everything the road router avoids that intrudes into the LANE_HALF-wide strip.
 */
export function laneIntrusions(layout: BiomeLayout, bearings: number[]): string[] {
  const center = centerOf(layout);
  const [sn, se] = localNE(center, layout.spawn);
  const bad: string[] = [];
  for (const b of bearings) {
    const un = Math.cos((b * Math.PI) / 180);
    const ue = Math.sin((b * Math.PI) / 180);
    // length to the town edge: |S + t u| = radius
    const pu = sn * un + se * ue;
    const len = -pu + Math.sqrt(pu * pu - (sn * sn + se * se - TOWN.radius ** 2));
    for (const o of townObstacles(layout)) {
      const vn = o.n - sn;
      const ve = o.e - se;
      const t = Math.max(0, Math.min(len, vn * un + ve * ue));
      const d = Math.hypot(vn - t * un, ve - t * ue);
      if (d < LANE_HALF + o.r) bad.push(`${b}°: ${o.what} at (${o.n.toFixed(1)}, ${o.e.toFixed(1)}) gap ${(d - o.r).toFixed(1)}`);
    }
  }
  return bad;
}

/** Ground height target (metres above PLANET_RADIUS at its centre) a pad flattens to. */
export function padTarget(pad: FlatPad): number {
  return preparePads([pad])[0].target;
}

/** Ground height (pads, no road beds) at lat/lon, metres above PLANET_RADIUS. */
export function groundAt(p: LatLon): number {
  const d = latLonToDir(p.lat, p.lon);
  return groundHeightNoRoadsXYZ(d.x, d.y, d.z);
}

/** Steepest grade (rise / run) along a straight drive through `points` sampled ~1 m apart. */
export function maxGrade(points: LatLon[]): number {
  let worst = 0;
  for (let i = 1; i < points.length; i++) {
    const run = degToMetres(angleBetween(points[i - 1], points[i]));
    if (run < 1e-6) continue;
    worst = Math.max(worst, Math.abs(groundAt(points[i]) - groundAt(points[i - 1])) / run);
  }
  return worst;
}

/** Town-budget checks for one layout (the same limits as budget.test.ts, with readable messages). */
export function checkTown(layout: BiomeLayout, bearings: number[]) {
  const center = centerOf(layout);
  const dist = (p: LatLon) => Math.hypot(...localNE(center, p));
  const over = layout.placements
    .map((p) => {
      const { min, max } = getModel(p.model);
      return { p, d: dist(p) + (Math.hypot(max[0] - min[0], max[2] - min[2]) / 2) * (p.scale ?? 1) };
    })
    .filter((x) => x.d > TOWN.radius - 0.05)
    .map((x) => `${x.p.model} ${x.d.toFixed(1)}`);
  expect(over).toEqual([]);
  for (const m of layout.markers) expect(dist(m), m.id).toBeLessThan(TOWN.radius);
  const spawnD = dist(layout.spawn);
  expect(spawnD).toBeGreaterThanOrEqual(5);
  expect(spawnD).toBeLessThanOrEqual(25);
  for (const p of layout.pads) expect(dist(p) + p.radius + (p.blend ?? 8), `pad r=${p.radius}`).toBeLessThan(TOWN.padReach);
  expect(laneIntrusions(layout, bearings)).toEqual([]);
}

/**
 * Drivable cells on a 1 m local grid around the biome centre (out to `extent` m): free of solid
 * colliders (a car-sized margin) with gentle steps between neighbours. Returns the targets that the
 * flood fill from the spawn cannot reach.
 */
export function unreachable(layout: BiomeLayout, targets: { name: string; at: LatLon }[], extent = 44, maxGradeStep = 0.6) {
  const center = centerOf(layout);
  const { at } = gridAt(center);
  const boxes = solidBoxes(layout).map(({ box }) => ({
    c: new Vector3(...box.center),
    q: new Quaternion(...box.quaternion).invert(),
    h: box.halfExtents,
    r: Math.hypot(...box.halfExtents) + 1.2,
  }));
  const N = 2 * extent + 1;
  const idx = (i: number, j: number) => i * N + j;
  const free = new Uint8Array(N * N);
  const height = new Float32Array(N * N);
  const d = new Vector3();
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const n = i - extent;
      const e = j - extent;
      if (Math.hypot(n, e) > extent) continue;
      const ll = at(n, e);
      height[idx(i, j)] = groundAt(ll);
      const p = pointAt(ll, 1.1);
      const hit = boxes.some((b) => {
        if (p.distanceTo(b.c) > b.r) return false;
        d.copy(p).sub(b.c).applyQuaternion(b.q);
        return Math.abs(d.x) < b.h[0] + 1.2 && Math.abs(d.y) < b.h[1] + 1.2 && Math.abs(d.z) < b.h[2] + 1.2;
      });
      free[idx(i, j)] = hit ? 0 : 1;
    }
  }
  const cell = (p: LatLon) => {
    const [n, e] = localNE(center, p);
    return [Math.round(n) + extent, Math.round(e) + extent] as const;
  };
  const seen = new Uint8Array(N * N);
  const [si, sj] = cell(layout.spawn);
  const queue = [idx(si, sj)];
  seen[idx(si, sj)] = 1;
  while (queue.length) {
    const k = queue.pop()!;
    const i = Math.floor(k / N);
    const j = k % N;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const m = idx(a, b);
      if (seen[m] || !free[m] || Math.abs(height[m] - height[k]) > maxGradeStep) continue;
      seen[m] = 1;
      queue.push(m);
    }
  }
  return targets
    .filter((t) => {
      const [i, j] = cell(t.at);
      // a marker's ring: any reached cell within 2 m counts
      for (let a = i - 2; a <= i + 2; a++) for (let b = j - 2; b <= j + 2; b++) if (seen[idx(a, b)]) return false;
      return true;
    })
    .map((t) => t.name);
}
