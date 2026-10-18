// Pure builders for the road network's visuals: the asphalt ribbon (one merged geometry) and the
// sign poses at every road end. Heights come from terrainHeight, so both sit exactly on the mesh.

import { BufferAttribute, BufferGeometry, Matrix4, Quaternion, Vector3 } from "three";
import { BIOMES } from "@/world/planet/biomes";
import { PLANET_RADIUS } from "@/world/planet/config";
import { surfaceRadius } from "@/world/planet/frame";
import { layoutObstacles } from "@/world/planet/obstacles";
import { ROAD_HALF_WIDTH, getRoads, nearestRoadXYZ, type PreparedRoad, type RoadHit } from "@/world/planet/roads";
import type { BiomeId } from "@/world/planet/types";

const R = PLANET_RADIUS;
/** Asphalt floats this far over the bed (plus a polygon offset) so it never z-fights the ground */
export const RIBBON_LIFT = 0.14;
/** Metres of road per texture repeat (one dash + gap of the centre line) */
export const RIBBON_TEXTURE_LENGTH = 6;
/** Vertices across the road (left edge → right edge); the bed is flat there, but the mesh is faceted */
const ACROSS = [1, 0.5, 0, -0.5, -1];

const point = (r: PreparedRoad, i: number, out: Vector3) => out.set(r.p[i * 3], r.p[i * 3 + 1], r.p[i * 3 + 2]);

/** Unit direction of travel (from → to) at point i, on the tangent plane. */
export function roadTangent(r: PreparedRoad, i: number, out = new Vector3()): Vector3 {
  const a = point(r, Math.max(0, i - 1), new Vector3());
  const b = point(r, Math.min(r.count - 1, i + 1), new Vector3());
  const up = point(r, i, new Vector3());
  out.subVectors(b, a);
  return out.addScaledVector(up, -out.dot(up)).normalize();
}

/** Every road as one indexed ribbon: position, normal, uv (u across 0..1, v in texture repeats). */
export function buildRoadRibbon(roads: readonly PreparedRoad[] = getRoads()): BufferGeometry {
  const verts: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const up = new Vector3();
  const t = new Vector3();
  const left = new Vector3();
  const d = new Vector3();
  const n = ACROSS.length;
  const hit: RoadHit = { dist: 0, target: 0, road: 0, seg: 0, t: 0 };
  roads.forEach((r, ri) => {
    const base = verts.length / 3;
    // Where roads share a hub, rows already paved by an earlier road are skipped (no z-fighting)
    const earlier = roads.slice(0, ri);
    const keep: boolean[] = [];
    let v = 0;
    for (let i = 0; i < r.count; i++) {
      point(r, i, up);
      keep.push(nearestRoadXYZ(up.x, up.y, up.z, earlier, hit).dist > ROAD_HALF_WIDTH * 0.9);
      if (i > 0) v += up.distanceTo(point(r, i - 1, d)) * (R / RIBBON_TEXTURE_LENGTH);
      roadTangent(r, i, t);
      left.crossVectors(up, t).normalize(); // up × forward = left
      for (let k = 0; k < n; k++) {
        d.copy(up).addScaledVector(left, (ACROSS[k] * ROAD_HALF_WIDTH) / R).normalize();
        d.multiplyScalar(surfaceRadius(d) + RIBBON_LIFT);
        verts.push(d.x, d.y, d.z);
        uvs.push(k / (n - 1), v);
      }
    }
    for (let i = 0; i < r.count - 1; i++) {
      if (!keep[i] || !keep[i + 1]) continue;
      for (let k = 0; k < n - 1; k++) {
        const a = base + i * n + k;
        const b = a + n;
        // CCW seen from above (outside the planet): left edge → right edge, forward
        index.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(verts), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** A road-end sign: stands beside the road, its +Z facing out of town (toward arriving traffic). */
export interface RoadSign {
  key: string;
  /** The town at this end, and the one the road leads to */
  here: BiomeId;
  there: BiomeId;
  /** Paved distance to `there`, metres */
  distance: number;
  position: Vector3;
  quaternion: Quaternion;
}

/** Candidate spots for a sign, tried in order: metres from the town end, and side of the road */
const SIGN_ALONG = [10, 14, 18, 6, 22, 26];
/** Distance from the road centre to the board's centre (posts at ±SIGN_POST_X along the board) */
export const SIGN_SIDE = ROAD_HALF_WIDTH + 4.6;
export const SIGN_POST_X = 3;
/** Posts keep this far from every road centre line, and the board centre this far from footprints */
const SIGN_ROAD_GAP = ROAD_HALF_WIDTH + 1.2;
const SIGN_OBSTACLE_GAP = 1.5;

/**
 * One sign per road end. Each tries a few spots (along the road, then either side) and takes the
 * first one whose posts are off every road and whose board is clear of every footprint (towns where
 * several roads leave from the same hub would otherwise plant a sign on a neighbouring road).
 */
export function roadSigns(roads: readonly PreparedRoad[] = getRoads(), obstacles = layoutObstacles()): RoadSign[] {
  const signs: RoadSign[] = [];
  const hit: RoadHit = { dist: 0, target: 0, road: 0, seg: 0, t: 0 };
  const at = new Vector3();
  const out = new Vector3();
  const side = new Vector3();
  const clear = (p: Vector3, x: Vector3): boolean => {
    for (const s of [-SIGN_POST_X, SIGN_POST_X]) {
      const post = p.clone().addScaledVector(x, s / R).normalize();
      if (nearestRoadXYZ(post.x, post.y, post.z, roads, hit).dist < SIGN_ROAD_GAP) return false;
    }
    for (const o of obstacles) {
      const gap = Math.acos(Math.min(1, p.x * o.x + p.y * o.y + p.z * o.z)) * R - o.r;
      if (gap < SIGN_OBSTACLE_GAP + SIGN_POST_X) return false;
    }
    return true;
  };

  for (const r of roads) {
    for (const atStart of [true, false]) {
      let best: { up: Vector3; out: Vector3 } | null = null;
      search: for (const along of SIGN_ALONG) {
        const k = Math.min(r.count - 1, Math.round(along / 2));
        const i = atStart ? k : r.count - 1 - k;
        point(r, i, at);
        roadTangent(r, i, out);
        if (!atStart) out.negate(); // "out of town" at the far end runs back toward `from`
        for (const s of [1, -1]) {
          // s = 1: left of departing traffic = the right of arriving traffic, which reads the front
          side.crossVectors(at, out).normalize().multiplyScalar(s);
          const up = at.clone().addScaledVector(side, SIGN_SIDE / R).normalize();
          const fwd = out.clone().addScaledVector(up, -out.dot(up)).normalize();
          if (clear(up, new Vector3().crossVectors(up, fwd).normalize())) {
            best = { up, out: fwd };
            break search;
          }
        }
      }
      if (!best) continue; // no clear spot: this road end goes without a sign
      const { up, out: fwd } = best;
      // Same basis as planet/frame surfacePose: +X = up × forward, +Y = up, +Z = forward
      const x = new Vector3().crossVectors(up, fwd).normalize();
      signs.push({
        key: `${r.from}-${r.to}-${atStart ? "a" : "b"}`,
        here: atStart ? r.from : r.to,
        there: atStart ? r.to : r.from,
        distance: r.length,
        position: up.clone().multiplyScalar(surfaceRadius(up)),
        quaternion: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, up, fwd)),
      });
    }
  }
  return signs;
}

export const biomeName = (id: BiomeId) => BIOMES.find((b) => b.id === id)?.name ?? id;
