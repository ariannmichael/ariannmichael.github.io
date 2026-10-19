// Geodesic (Class I) icosphere grid shared by the mesh builder and `terrainHeight`.
// Each of the 20 icosahedron faces is cut into SUBDIVISIONS² triangles on the *flat* face, and
// every grid point is pushed out radially. Because displacement is radial, a ray from the centre
// through any direction crosses exactly one grid cell on the flat face, and that cell is exactly
// the mesh triangle above it. That's what lets `terrainHeight` return the rendered/collider
// surface height exactly, not an approximation.

/**
 * Edge subdivisions per icosahedron face. Triangles = 20·N² → 27 gives 14,580 triangles with
 * ~3.7 m edges at R = 90 (one mesh for both render and the Rapier trimesh; see terrainMesh.ts).
 */
export const SUBDIVISIONS = 27;

const T = (1 + Math.sqrt(5)) / 2;
// Same corner/face table as three's IcosahedronGeometry (faces wound CCW seen from outside).
const RAW_VERTS = [-1, T, 0, 1, T, 0, -1, -T, 0, 1, -T, 0, 0, -1, T, 0, 1, T, 0, -1, -T, 0, 1, -T, T, 0, -1, T, 0, 1, -T, 0, -1, -T, 0, 1];
export const ICO_FACES = new Uint8Array([
  0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2,
  6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
]);
export const ICO_VERTS = new Float64Array(36);
for (let i = 0; i < 12; i++) {
  const x = RAW_VERTS[i * 3];
  const y = RAW_VERTS[i * 3 + 1];
  const z = RAW_VERTS[i * 3 + 2];
  const l = Math.hypot(x, y, z);
  ICO_VERTS[i * 3] = x / l;
  ICO_VERTS[i * 3 + 1] = y / l;
  ICO_VERTS[i * 3 + 2] = z / l;
}

// Per face: corner a, edge vectors e1 = b − a, e2 = c − a, unit normal n, and barycentric terms.
const FACE = new Float64Array(20 * 16);
const O_A = 0, O_E1 = 3, O_E2 = 6, O_N = 9, O_D00 = 12, O_D01 = 13, O_D11 = 14, O_INV = 15;
for (let f = 0; f < 20; f++) {
  const ia = ICO_FACES[f * 3] * 3, ib = ICO_FACES[f * 3 + 1] * 3, ic = ICO_FACES[f * 3 + 2] * 3;
  const o = f * 16;
  for (let k = 0; k < 3; k++) {
    FACE[o + O_A + k] = ICO_VERTS[ia + k];
    FACE[o + O_E1 + k] = ICO_VERTS[ib + k] - ICO_VERTS[ia + k];
    FACE[o + O_E2 + k] = ICO_VERTS[ic + k] - ICO_VERTS[ia + k];
  }
  const e1x = FACE[o + O_E1], e1y = FACE[o + O_E1 + 1], e1z = FACE[o + O_E1 + 2];
  const e2x = FACE[o + O_E2], e2y = FACE[o + O_E2 + 1], e2z = FACE[o + O_E2 + 2];
  let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl; ny /= nl; nz /= nl;
  FACE[o + O_N] = nx; FACE[o + O_N + 1] = ny; FACE[o + O_N + 2] = nz;
  const d00 = e1x * e1x + e1y * e1y + e1z * e1z;
  const d01 = e1x * e2x + e1y * e2y + e1z * e2z;
  const d11 = e2x * e2x + e2y * e2y + e2z * e2z;
  FACE[o + O_D00] = d00; FACE[o + O_D01] = d01; FACE[o + O_D11] = d11;
  FACE[o + O_INV] = 1 / (d00 * d11 - d01 * d01);
}
// Distance from the centre to every (flat) face plane; identical for a regular icosahedron.
const PLANE_D =
  FACE[O_A] * FACE[O_N] + FACE[O_A + 1] * FACE[O_N + 1] + FACE[O_A + 2] * FACE[O_N + 2];

/**
 * Unit direction of grid point (i, j) on face `f` (i steps toward corner b, j toward c).
 * Writes x, y, z into `out` at `offset`.
 */
export function gridDir(f: number, i: number, j: number, out: Float64Array | Float32Array, offset = 0, n = SUBDIVISIONS) {
  const o = f * 16;
  const u = i / n;
  const v = j / n;
  const x = FACE[o] + FACE[o + O_E1] * u + FACE[o + O_E2] * v;
  const y = FACE[o + 1] + FACE[o + O_E1 + 1] * u + FACE[o + O_E2 + 1] * v;
  const z = FACE[o + 2] + FACE[o + O_E1 + 2] * u + FACE[o + O_E2 + 2] * v;
  const l = Math.hypot(x, y, z);
  out[offset] = x / l;
  out[offset + 1] = y / l;
  out[offset + 2] = z / l;
}

/** Result of locating a direction in the grid: face, the three grid corners (i, j pairs). */
export interface GridCell {
  face: number;
  i0: number; j0: number;
  i1: number; j1: number;
  i2: number; j2: number;
}

/**
 * Finds the mesh triangle that the ray from the centre along (x, y, z) passes through.
 * Writes into `cell` (no allocations). The triangle corners are in the mesh's CCW order.
 */
export function locateCell(x: number, y: number, z: number, cell: GridCell, n = SUBDIVISIONS): GridCell {
  // For a convex polyhedron centred on the origin with equal plane distances, the ray exits through
  // the face whose normal is most aligned with it.
  let best = 0;
  let bestDot = -Infinity;
  for (let f = 0; f < 20; f++) {
    const o = f * 16 + O_N;
    const d = x * FACE[o] + y * FACE[o + 1] + z * FACE[o + 2];
    if (d > bestDot) {
      bestDot = d;
      best = f;
    }
  }
  const o = best * 16;
  const s = PLANE_D / bestDot;
  const wx = x * s - FACE[o], wy = y * s - FACE[o + 1], wz = z * s - FACE[o + 2];
  const d20 = wx * FACE[o + O_E1] + wy * FACE[o + O_E1 + 1] + wz * FACE[o + O_E1 + 2];
  const d21 = wx * FACE[o + O_E2] + wy * FACE[o + O_E2 + 1] + wz * FACE[o + O_E2 + 2];
  const inv = FACE[o + O_INV];
  const u = (FACE[o + O_D11] * d20 - FACE[o + O_D01] * d21) * inv;
  const v = (FACE[o + O_D00] * d21 - FACE[o + O_D01] * d20) * inv;

  const su = Math.max(0, u * n);
  const sv = Math.max(0, v * n);
  let i = Math.min(n - 1, Math.floor(su));
  let j = Math.min(n - 1, Math.floor(sv));
  if (i + j > n - 1) {
    // Only reachable through rounding on the far edge: pull back into the last row of cells.
    if (su - i > sv - j) j = n - 1 - i;
    else i = n - 1 - j;
  }
  const fu = su - i;
  const fv = sv - j;
  cell.face = best;
  if (fu + fv > 1 && i + j <= n - 2) {
    // Upper triangle of the rhombus: (i+1, j), (i+1, j+1), (i, j+1)
    cell.i0 = i + 1; cell.j0 = j;
    cell.i1 = i + 1; cell.j1 = j + 1;
    cell.i2 = i; cell.j2 = j + 1;
  } else {
    // Lower triangle: (i, j), (i+1, j), (i, j+1)
    cell.i0 = i; cell.j0 = j;
    cell.i1 = i + 1; cell.j1 = j;
    cell.i2 = i; cell.j2 = j + 1;
  }
  return cell;
}
