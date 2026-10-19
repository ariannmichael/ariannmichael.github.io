// Pure builders for the road network's visuals: the paved ribbon (one merged geometry) and the sign
// poses at every road end. Heights come from terrainHeight, so both sit exactly on the mesh.
//
// The ribbon IS the Kenney city-roads tile, extruded: the same cross-section (raised sidewalks, kerbs,
// dark gutters, two lanes and the centre line, at the tiles' 1.02 × 8 m scale) and the same palette
// swatches (UVs into the kit's colormap), so it renders with the tiles' own material. Each end attaches
// to its road port (planet/roadPorts.ts): the end row is the tile's open edge itself, and the next rows
// ease from the tile's plane onto the terrain over the port's straight lead, so ribbon and tile meet
// flush with their kerbs, lanes and centre lines aligned.

import { BufferAttribute, BufferGeometry, Matrix4, Quaternion, Vector3 } from "three";
import { BIOMES } from "@/world/planet/biomes";
import { PLANET_RADIUS } from "@/world/planet/config";
import { surfaceRadius } from "@/world/planet/frame";
import { layoutObstacles } from "@/world/planet/obstacles";
import { PORT_LEAD, findRoadPort, portPose, type PortPose } from "@/world/planet/roadPorts";
import { ROAD_HALF_WIDTH, getRoads, nearestRoadXYZ, type PreparedRoad, type RoadHit } from "@/world/planet/roads";
import { smoothstep } from "@/world/planet/noise";
import type { BiomeId } from "@/world/planet/types";

const R = PLANET_RADIUS;
/** Metres per tile unit: city-roads tiles are 1 unit, × 8 (kit scale) × 1.02 (the towns' oversize) */
export const RIBBON_TILE_SCALE = 8 * 1.02;
/** The asphalt floats this far over the bed so it never z-fights the faceted ground */
export const RIBBON_LIFT = 0.14;
/** The city-roads kit palette the ribbon samples (the tiles' material) */
export const RIBBON_PALETTE = "/models/city-roads/colormap.webp";

/** Palette swatch centres (glTF UVs, v down) of the tile's colours */
const SWATCH = {
  sidewalk: [0.46875, 0.52441], // #bdc6ee: sidewalk tops and outer faces
  kerb: [0.46875, 0.62598], // #9da5c5: kerb faces toward the road
  gutter: [0.125, 0.875], // #515566: the dark band along each kerb
  lane: [0.3125, 0.875], // #666b80: asphalt
  line: [0.4375, 0.875], // #8e95b3: centre line
} as const;

/**
 * The tile's cross-section, left (+) to right (−), in tile units: [across, height] pairs per strip
 * (from the tile: sidewalks |x| 0.4–0.5 at height 0.02, gutters 0.3–0.4 and lanes at 0.01, a 0.02 wide
 * centre line). Outer faces reach below the ground so no gap shows under the sidewalk's edge.
 */
const BELOW = -0.03;
const STRIPS: { a: [number, number]; b: [number, number]; uv: readonly [number, number] }[] = [
  { a: [0.5, BELOW], b: [0.5, 0.02], uv: SWATCH.sidewalk },
  { a: [0.5, 0.02], b: [0.4, 0.02], uv: SWATCH.sidewalk },
  { a: [0.4, 0.02], b: [0.4, 0.01], uv: SWATCH.kerb },
  { a: [0.4, 0.01], b: [0.3, 0.01], uv: SWATCH.gutter },
  { a: [0.3, 0.01], b: [0.01, 0.01], uv: SWATCH.lane },
  { a: [0.01, 0.01], b: [-0.01, 0.01], uv: SWATCH.line },
  { a: [-0.01, 0.01], b: [-0.3, 0.01], uv: SWATCH.lane },
  { a: [-0.3, 0.01], b: [-0.4, 0.01], uv: SWATCH.gutter },
  { a: [-0.4, 0.01], b: [-0.4, 0.02], uv: SWATCH.kerb },
  { a: [-0.4, 0.02], b: [-0.5, 0.02], uv: SWATCH.sidewalk },
  { a: [-0.5, 0.02], b: [-0.5, BELOW], uv: SWATCH.sidewalk },
];
/** Tile height of the asphalt (what RIBBON_LIFT puts over the bed away from the ports) */
const ASPHALT = 0.01;
/** Half the ribbon's full width (sidewalk edge to centre), metres */
export const RIBBON_HALF_WIDTH = 0.5 * RIBBON_TILE_SCALE;
/** A row is dropped when either outer edge would advance less than this past the previous row (fold) */
const MIN_EDGE_STEP = 0.2;

const point = (r: PreparedRoad, i: number, out: Vector3) => out.set(r.p[i * 3], r.p[i * 3 + 1], r.p[i * 3 + 2]);

/** Unit direction of travel (from → to) at point i, on the tangent plane. */
export function roadTangent(r: PreparedRoad, i: number, out = new Vector3()): Vector3 {
  const a = point(r, Math.max(0, i - 1), new Vector3());
  const b = point(r, Math.min(r.count - 1, i + 1), new Vector3());
  const up = point(r, i, new Vector3());
  out.subVectors(b, a);
  return out.addScaledVector(up, -out.dot(up)).normalize();
}

/** World position of a cross-section point (across, height in tile units) on a port's open edge. */
function portEdgePoint(p: PortPose, across: number, height: number, out: Vector3): Vector3 {
  return out
    .copy(p.edge)
    .addScaledVector(p.left, across * p.scale)
    .addScaledVector(p.up, height * p.scale);
}

/** Where the ray along unit `d` meets the port tile's plane lifted by `height` tile units: distance from the centre. */
function tilePlaneRadius(p: PortPose, d: Vector3, height: number): number {
  return (p.origin.dot(p.up) + height * p.scale) / Math.max(d.dot(p.up), 0.5);
}

/**
 * Every road as one indexed ribbon of the tile's cross-section: position, normal and palette uv.
 * `ports` resolves a road end's port (injectable for tests; none = the end sits on the terrain).
 */
export function buildRoadRibbon(
  roads: readonly PreparedRoad[] = getRoads(),
  ports: (here: BiomeId, there: BiomeId) => PortPose | null = (here, there) => {
    const port = findRoadPort(here, there);
    return port ? portPose(port) : null;
  },
): BufferGeometry {
  const verts: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const up = new Vector3();
  const t = new Vector3();
  const left = new Vector3();
  const d = new Vector3();
  const prevL = new Vector3();
  const prevR = new Vector3();
  const edgeL = new Vector3();
  const edgeR = new Vector3();
  for (const r of roads) {
    const startPort = ports(r.from, r.to);
    const endPort = ports(r.to, r.from);
    // Distance along the road of every point, for the ease off each port's tile plane
    const along = [0];
    for (let i = 1; i < r.count; i++) along.push(along[i - 1] + point(r, i, up).distanceTo(point(r, i - 1, d)) * R);
    const length = along[r.count - 1];
    let prevRow = -1;
    for (let i = 0; i < r.count; i++) {
      point(r, i, up);
      roadTangent(r, i, t);
      left.crossVectors(up, t).normalize(); // up × forward = left
      // Fold guard: a row whose outer edge would step backwards is dropped (ends are always kept)
      edgeL.copy(up).addScaledVector(left, RIBBON_HALF_WIDTH / R);
      edgeR.copy(up).addScaledVector(left, -RIBBON_HALF_WIDTH / R);
      if (prevRow >= 0 && i < r.count - 1) {
        const stepL = edgeL.clone().sub(prevL).dot(t) * R;
        const stepR = edgeR.clone().sub(prevR).dot(t) * R;
        if (Math.min(stepL, stepR) < MIN_EDGE_STEP) continue;
      }
      // Port at this end of the road (exact edge row), and how far the row is into its lead
      const port = i === 0 ? startPort : i === r.count - 1 ? endPort : null;
      const near = along[i] < PORT_LEAD ? startPort : length - along[i] < PORT_LEAD ? endPort : null;
      const ease = near ? smoothstep(0, PORT_LEAD, near === startPort ? along[i] : length - along[i]) : 1;
      const base = verts.length / 3;
      for (const strip of STRIPS) {
        for (const [across, height] of [strip.a, strip.b]) {
          if (port) {
            // The end row is the tile's open edge: across measured along the tile's own left axis,
            // which at the far end of a road points the other way
            portEdgePoint(port, i === 0 ? across : -across, height, d);
          } else {
            d.copy(up).addScaledVector(left, (across * RIBBON_TILE_SCALE) / R).normalize();
            const onGround = surfaceRadius(d) + RIBBON_LIFT + (height - ASPHALT) * RIBBON_TILE_SCALE;
            const radius = near ? tilePlaneRadius(near, d, height) * (1 - ease) + onGround * ease : onGround;
            d.multiplyScalar(radius);
          }
          verts.push(d.x, d.y, d.z);
          uvs.push(strip.uv[0], strip.uv[1]);
        }
      }
      if (prevRow >= 0) {
        for (let k = 0; k < STRIPS.length; k++) {
          const a = prevRow + k * 2;
          const b = base + k * 2;
          // Strip from its first point to its second, forward: across × forward faces outward
          index.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
      prevRow = base;
      prevL.copy(edgeL);
      prevR.copy(edgeR);
    }
  }
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
/** Board centres stay this far apart: two boards side by side (posts at ±SIGN_POST_X) and a 2 m gap */
export const SIGN_SPACING = 2 * SIGN_POST_X + 2;

/**
 * One sign per road end. Each tries a few spots (along the road, then either side) and takes the
 * first one whose posts are off every road, whose board is clear of every footprint and which stands
 * SIGN_SPACING from every sign already placed (two roads leaving one hub would otherwise cross boards).
 */
export function roadSigns(roads: readonly PreparedRoad[] = getRoads(), obstacles = layoutObstacles()): RoadSign[] {
  const signs: RoadSign[] = [];
  const hit: RoadHit = { dist: 0, target: 0, road: 0, seg: 0, t: 0 };
  const at = new Vector3();
  const out = new Vector3();
  const side = new Vector3();
  const clear = (p: Vector3, x: Vector3): boolean => {
    for (const s of signs) {
      if (s.position.clone().normalize().angleTo(p) * R < SIGN_SPACING) return false;
    }
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
