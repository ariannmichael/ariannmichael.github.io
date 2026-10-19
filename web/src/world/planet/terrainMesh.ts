// Planet mesh: a geodesic icosphere displaced by the terrain field.
//
// One resolution serves both rendering and physics (SUBDIVISIONS = 44 → 38,720 triangles, ~3.8 m
// edges). Sharing it means the trimesh the car drives on, the triangles you see, and
// `terrainHeight` (which intersects these exact triangles) all agree — no floating props or
// wheels sinking into a finer render mesh. ~3.8 m faceted triangles also suit the PS1 look.
//
// Rendering uses non-indexed geometry: each face has its own 3 vertices with one flat colour and
// the face normal, i.e. hard PS1 facets and no colour gradients inside a triangle.

import { BufferAttribute, BufferGeometry } from "three";
import { PLANET_RADIUS } from "./config";
import { analyticHeightXYZ, getDefaultPads, type PreparedPad } from "./terrain";
import { faceColor } from "./terrainColor";
import { gridDir, ICO_FACES, SUBDIVISIONS } from "./terrainGrid";

export interface PlanetMeshData {
  /** Indexed vertex positions (world space, planet centre = origin) */
  positions: Float32Array;
  /** Unit direction of each vertex (float64 for exact height checks) */
  dirs: Float64Array;
  /** Terrain height of each vertex (metres above PLANET_RADIUS) */
  heights: Float64Array;
  /** Triangle indices, CCW seen from outside */
  indices: Uint32Array;
}

/** Vertices of a Class I geodesic sphere with `n` subdivisions. */
export const vertexCount = (n: number) => 10 * n * n + 2;
export const triangleCount = (n: number) => 20 * n * n;

/**
 * Builds the indexed planet surface. Shared vertices along icosahedron edges are deduplicated
 * so the collider is watertight. `pads` defaults to the layouts' flat pads.
 */
export function buildPlanetMeshData(
  pads: readonly PreparedPad[] = getDefaultPads(),
  n: number = SUBDIVISIONS,
): PlanetMeshData {
  const V = vertexCount(n);
  const dirs = new Float64Array(V * 3);
  const heights = new Float64Array(V);
  const positions = new Float32Array(V * 3);
  const done = new Uint8Array(V);
  const indices = new Uint32Array(triangleCount(n) * 3);

  // Global vertex numbering: 12 corners, then (n−1) per icosahedron edge, then face interiors.
  const edgeBase = new Map<number, number>();
  let next = 12;
  for (let f = 0; f < 20; f++) {
    for (let e = 0; e < 3; e++) {
      const p = ICO_FACES[f * 3 + e];
      const q = ICO_FACES[f * 3 + ((e + 1) % 3)];
      const key = Math.min(p, q) * 12 + Math.max(p, q);
      if (!edgeBase.has(key)) {
        edgeBase.set(key, next);
        next += n - 1;
      }
    }
  }
  /** Index of the point `m` steps from corner p toward corner q. */
  const edgeVertex = (p: number, q: number, m: number) =>
    p < q ? edgeBase.get(p * 12 + q)! + m - 1 : edgeBase.get(q * 12 + p)! + (n - m) - 1;

  const grid = new Int32Array((n + 1) * (n + 1));
  const g = (i: number, j: number) => j * (n + 1) + i;
  let ti = 0;

  for (let f = 0; f < 20; f++) {
    const a = ICO_FACES[f * 3];
    const b = ICO_FACES[f * 3 + 1];
    const c = ICO_FACES[f * 3 + 2];
    // Map this face's (i, j) grid to global vertex ids, computing new vertices as we go.
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n - j; i++) {
        let id: number;
        if (i === 0 && j === 0) id = a;
        else if (i === n) id = b;
        else if (j === n) id = c;
        else if (j === 0) id = edgeVertex(a, b, i);
        else if (i === 0) id = edgeVertex(a, c, j);
        else if (i + j === n) id = edgeVertex(b, c, j);
        else id = next++;
        grid[g(i, j)] = id;
        if (!done[id]) {
          done[id] = 1;
          gridDir(f, i, j, dirs, id * 3, n);
          const x = dirs[id * 3], y = dirs[id * 3 + 1], z = dirs[id * 3 + 2];
          const h = analyticHeightXYZ(x, y, z, pads);
          heights[id] = h;
          const r = PLANET_RADIUS + h;
          positions[id * 3] = x * r;
          positions[id * 3 + 1] = y * r;
          positions[id * 3 + 2] = z * r;
        }
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n - j; i++) {
        indices[ti++] = grid[g(i, j)];
        indices[ti++] = grid[g(i + 1, j)];
        indices[ti++] = grid[g(i, j + 1)];
        if (i + j <= n - 2) {
          indices[ti++] = grid[g(i + 1, j)];
          indices[ti++] = grid[g(i + 1, j + 1)];
          indices[ti++] = grid[g(i, j + 1)];
        }
      }
    }
  }
  return { positions, dirs, heights, indices };
}

let cached: PlanetMeshData | null = null;
/** The default planet (layout pads, SUBDIVISIONS), built once and shared by render + physics. */
export function getPlanetMeshData(): PlanetMeshData {
  if (!cached) cached = buildPlanetMeshData();
  return cached;
}

/**
 * Non-indexed render geometry: per-face flat normals and per-face vertex colours (PS1 facets).
 * Attributes: position, normal, color (linear RGB).
 */
export function buildPlanetGeometry(data: PlanetMeshData = getPlanetMeshData()): BufferGeometry {
  const { positions: P, indices } = data;
  const triCount = indices.length / 3;
  const pos = new Float32Array(triCount * 9);
  const nor = new Float32Array(triCount * 9);
  const col = new Float32Array(triCount * 9);
  const rgb = new Float32Array(3);

  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    const ax = P[a], ay = P[a + 1], az = P[a + 2];
    const bx = P[b], by = P[b + 1], bz = P[b + 2];
    const cx = P[c], cy = P[c + 1], cz = P[c + 2];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    // Centroid direction = the face's "up"; cosSlope = how level the face is.
    let mx = ax + bx + cx, my = ay + by + cy, mz = az + bz + cz;
    const ml = Math.hypot(mx, my, mz);
    mx /= ml; my /= ml; mz /= ml;
    faceColor(mx, my, mz, nx * mx + ny * my + nz * mz, t, rgb, 0);

    const o = t * 9;
    pos[o] = ax; pos[o + 1] = ay; pos[o + 2] = az;
    pos[o + 3] = bx; pos[o + 4] = by; pos[o + 5] = bz;
    pos[o + 6] = cx; pos[o + 7] = cy; pos[o + 8] = cz;
    for (let k = 0; k < 9; k += 3) {
      nor[o + k] = nx; nor[o + k + 1] = ny; nor[o + k + 2] = nz;
      col[o + k] = rgb[0]; col[o + k + 1] = rgb[1]; col[o + k + 2] = rgb[2];
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("normal", new BufferAttribute(nor, 3));
  geo.setAttribute("color", new BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** Rapier trimesh input: the same triangles as the render mesh, indexed. */
export function buildPlanetColliderData(data: PlanetMeshData = getPlanetMeshData()): {
  vertices: Float32Array;
  indices: Uint32Array;
} {
  return { vertices: data.positions, indices: data.indices };
}
