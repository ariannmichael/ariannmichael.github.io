// Test-side layout checks for the gamedev and badlands layouts (biome agent C).
// Imports terrain via planetPlacement, so only use it from tests (never from layout modules).
import { Quaternion, Vector3 } from "three";
import { planetColliderBox, markerSensorBox, type OrientedBox } from "@/world/lib/planetPlacement";
import { resolveCollider } from "@/world/lib/placement";
import { getModel, hasModel } from "@/world/models";
import { PLANET_RADIUS } from "@/world/planet/config";
import { latLonToDir, surfacePose } from "@/world/planet/frame";
import type { BiomeLayout, LatLon } from "@/world/planet/types";
import { grid } from "../author";

/** Marker sensor size used by Zones.tsx (6 × 4 × 6 m). */
export const SENSOR = { size: 6, height: 4 };

/** Fixed (non-dynamic) collider boxes of a layout, with the placement index for messages. */
export function fixedBoxes(layout: BiomeLayout): { index: number; model: string; box: OrientedBox }[] {
  const out: { index: number; model: string; box: OrientedBox }[] = [];
  layout.placements.forEach((p, index) => {
    if (p.body === "dynamic" || !hasModel(p.model)) return;
    const bounds = getModel(p.model);
    if (resolveCollider(p, bounds) !== "box") return;
    out.push({ index, model: p.model, box: planetColliderBox(p, bounds) });
  });
  return out;
}

/** True when world point `pt` lies inside the oriented box (with an optional margin in metres). */
export function insideBox(pt: Vector3, box: OrientedBox, margin = 0): boolean {
  const inv = new Quaternion(...box.quaternion).invert();
  const local = pt.clone().sub(new Vector3(...box.center)).applyQuaternion(inv);
  return (
    Math.abs(local.x) <= box.halfExtents[0] + margin &&
    Math.abs(local.y) <= box.halfExtents[1] + margin &&
    Math.abs(local.z) <= box.halfExtents[2] + margin
  );
}

/** World point a little above the ground at lat/lon (where the car body would be). */
export function groundPoint(p: LatLon, height = 1): Vector3 {
  return surfacePose(p.lat, p.lon, 0, height).position;
}

export function sensorCenter(m: BiomeLayout["markers"][number]): Vector3 {
  return new Vector3(...markerSensorBox(m, SENSOR.size, SENSOR.height).center);
}

/** Budget counts for a layout. Skinned characters are counted by kit (each is its own clone). */
export function budgetCounts(layout: BiomeLayout) {
  const unique = new Set(layout.placements.map((p) => p.model));
  const characters = layout.placements.filter((p) => p.model.startsWith("mini-characters/character-")).length;
  const dynamic = layout.placements.filter((p) => p.body === "dynamic").length;
  return { placements: layout.placements.length, unique: unique.size, characters, dynamic };
}

/** Things that block a road lane: placements taller than 0.6 m, marker sensors, raised or dug pads. */
export function laneObstacles(layout: BiomeLayout): { what: string; dir: Vector3; r: number }[] {
  const out: { what: string; dir: Vector3; r: number }[] = [];
  layout.placements.forEach((p, i) => {
    const { min, max } = getModel(p.model);
    const s = p.scale ?? 1;
    if (max[1] * s + (p.y ?? 0) <= 0.6) return;
    out.push({ what: `${p.model}#${i}`, dir: latLonToDir(p.lat, p.lon), r: (Math.hypot(max[0] - min[0], max[2] - min[2]) / 2) * s });
  });
  for (const m of layout.markers) out.push({ what: `marker ${m.id}`, dir: latLonToDir(m.lat, m.lon), r: (SENSOR.size / 2) * Math.SQRT2 });
  layout.pads.forEach((p, i) => {
    if (!p.height) return;
    out.push({ what: `pad#${i}`, dir: latLonToDir(p.lat, p.lon), r: p.radius + (p.blend ?? 8) });
  });
  return out;
}

/**
 * Obstacles inside the road lanes: straight strips `halfWidth` either side of a line from the spawn
 * (local metres `spawnNE` on the biome grid) along each compass bearing (clockwise from grid north),
 * out to `reach` metres from the biome centre. Footprints are circles (bbox half-diagonal × scale).
 */
export function laneHits(
  layout: BiomeLayout,
  center: LatLon,
  spawnNE: [number, number],
  bearings: number[],
  halfWidth = 6,
  reach = 40,
): string[] {
  const g = grid(center);
  const c = latLonToDir(center.lat, center.lon);
  const [sn, se] = spawnNE;
  const S = latLonToDir(g.at(sn, se).lat, g.at(sn, se).lon);
  const obstacles = laneObstacles(layout);
  const hits: string[] = [];
  for (const b of bearings) {
    const cb = Math.cos((b * Math.PI) / 180);
    const sb = Math.sin((b * Math.PI) / 180);
    const ahead = g.at(sn + cb, se + sb);
    const h = latLonToDir(ahead.lat, ahead.lon).sub(S);
    h.addScaledVector(S, -h.dot(S)).normalize();
    const N = new Vector3().crossVectors(S, h).normalize();
    // Lane length: walk until the centreline leaves the town radius
    let len = 0;
    while (len < 200) {
      const a = len / PLANET_RADIUS;
      const q = S.clone().multiplyScalar(Math.cos(a)).addScaledVector(h, Math.sin(a));
      if (c.angleTo(q) * PLANET_RADIUS > reach) break;
      len += 0.25;
    }
    for (const o of obstacles) {
      const along = Math.atan2(o.dir.dot(h), o.dir.dot(S)) * PLANET_RADIUS;
      const cross = Math.abs(Math.asin(Math.max(-1, Math.min(1, o.dir.dot(N)))) * PLANET_RADIUS);
      const side = Math.max(0, cross - halfWidth);
      const end = along < 0 ? -along : along > len ? along - len : 0;
      if (Math.hypot(end, side) < o.r) hits.push(`${b}°: ${o.what} (along ${along.toFixed(1)}, off ${cross.toFixed(1)}, r ${o.r.toFixed(1)})`);
    }
  }
  return hits;
}

/**
 * Drivable-reachability check on a 0.5 m local grid: cells are blocked by fixed collider footprints
 * whose bottom is below `clearance` (so roofs and the mound overhead don't count) and by marker
 * sensors (the wheel raycasts hit them), each grown by the car's half-width. Flood-fills from the
 * spawn within `reach` metres of the centre and returns the labels of targets with no reachable cell
 * within `near` metres.
 */
export function unreachable(
  layout: BiomeLayout,
  center: LatLon,
  spawnNE: [number, number],
  targets: { label: string; n: number; e: number; near?: number }[],
  { halfWidth = 1.4, clearance = 2.2, reach = 46, step = 0.5 } = {},
): string[] {
  const g = grid(center);
  const boxes: { ctr: Vector3; inv: Quaternion; half: [number, number] }[] = [];
  layout.placements.forEach((p) => {
    if (p.body === "dynamic" || !hasModel(p.model)) return;
    const bounds = getModel(p.model);
    if (resolveCollider(p, bounds) !== "box") return;
    if ((p.y ?? 0) + bounds.min[1] * (p.scale ?? 1) > clearance) return;
    const b = planetColliderBox(p, bounds);
    boxes.push({ ctr: new Vector3(...b.center), inv: new Quaternion(...b.quaternion).invert(), half: [b.halfExtents[0], b.halfExtents[2]] });
  });
  for (const m of layout.markers) {
    const b = markerSensorBox(m, SENSOR.size, SENSOR.height);
    boxes.push({ ctr: new Vector3(...b.center), inv: new Quaternion(...b.quaternion).invert(), half: [b.halfExtents[0], b.halfExtents[2]] });
  }
  const size = Math.ceil(reach / step);
  const W = 2 * size + 1;
  const idx = (i: number, j: number) => (i + size) * W + (j + size);
  const blocked = new Uint8Array(W * W);
  for (let i = -size; i <= size; i++) {
    for (let j = -size; j <= size; j++) {
      const n = i * step;
      const e = j * step;
      if (Math.hypot(n, e) > reach) {
        blocked[idx(i, j)] = 1;
        continue;
      }
      const ll = g.at(n, e);
      const pt = latLonToDir(ll.lat, ll.lon).multiplyScalar(PLANET_RADIUS);
      for (const b of boxes) {
        if (b.ctr.distanceTo(pt) > 40) continue;
        const up = b.ctr.clone().normalize();
        const q = pt.clone().addScaledVector(up, b.ctr.dot(up) - pt.dot(up)).sub(b.ctr).applyQuaternion(b.inv);
        if (Math.abs(q.x) <= b.half[0] + halfWidth && Math.abs(q.z) <= b.half[1] + halfWidth) {
          blocked[idx(i, j)] = 1;
          break;
        }
      }
    }
  }
  const seen = new Uint8Array(W * W);
  const si = Math.round(spawnNE[0] / step);
  const sj = Math.round(spawnNE[1] / step);
  const queue: [number, number][] = [[si, sj]];
  seen[idx(si, sj)] = 1;
  while (queue.length) {
    const [i, j] = queue.pop()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di;
      const b = j + dj;
      if (Math.abs(a) > size || Math.abs(b) > size) continue;
      const k = idx(a, b);
      if (seen[k] || blocked[k]) continue;
      seen[k] = 1;
      queue.push([a, b]);
    }
  }
  return targets
    .filter(({ n, e, near = 0.5 }) => {
      const r = Math.ceil(near / step);
      for (let i = Math.round(n / step) - r; i <= Math.round(n / step) + r; i++) {
        for (let j = Math.round(e / step) - r; j <= Math.round(e / step) + r; j++) {
          if (Math.abs(i) > size || Math.abs(j) > size) continue;
          if (Math.hypot(i * step - n, j * step - e) <= near && seen[idx(i, j)]) return false;
        }
      }
      return true;
    })
    .map((t) => t.label);
}
