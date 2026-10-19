import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { BIOMES } from "./biomes";
import { BIOME_COUNT, biomeWeights } from "./biomeField";
import { mulberry32 } from "./noise";
import { analyticHeightXYZ, preparePads, terrainHeight } from "./terrain";
import { SUBDIVISIONS } from "./terrainGrid";
import { PLANET_RADIUS } from "@/world/planet/config";
import {
  buildPlanetColliderData,
  buildPlanetGeometry,
  buildPlanetMeshData,
  getPlanetMeshData,
  triangleCount,
  vertexCount,
} from "./terrainMesh";

const R = PLANET_RADIUS;

describe("planet mesh", () => {
  const t0 = performance.now();
  const data = getPlanetMeshData();
  const t1 = performance.now();
  const geo = buildPlanetGeometry(data);
  const t2 = performance.now();
  // Visible in `vitest --silent=false`; the budget is ≲ 300 ms on a laptop.
  console.info(
    `[terrain] ${triangleCount(SUBDIVISIONS)} tris, ${vertexCount(SUBDIVISIONS)} verts: ` +
      `heights ${(t1 - t0).toFixed(0)} ms, render geometry ${(t2 - t1).toFixed(0)} ms`,
  );

  it("builds within budget", () => {
    // Generous to keep CI stable; locally this is ~80 ms total.
    expect(t2 - t0).toBeLessThan(1500);
  });

  it("has the expected counts and a non-indexed render geometry", () => {
    const n = SUBDIVISIONS;
    expect(data.positions.length / 3).toBe(vertexCount(n));
    expect(data.indices.length / 3).toBe(triangleCount(n));
    expect(triangleCount(n)).toBeLessThanOrEqual(40000);
    expect(geo.index).toBeNull();
    expect(geo.getAttribute("position").count).toBe(triangleCount(n) * 3);
    expect(geo.getAttribute("color").count).toBe(triangleCount(n) * 3);
    expect(geo.getAttribute("normal").count).toBe(triangleCount(n) * 3);
    const col = buildPlanetColliderData(data);
    expect(col.vertices).toBe(data.positions);
    expect(col.indices).toBe(data.indices);
  });

  it("is watertight (every edge shared by exactly two triangles) and wound outward", () => {
    const I = data.indices;
    const P = data.positions;
    const V = P.length / 3;
    const edges = new Map<number, number>();
    for (let k = 0; k < I.length; k += 3) {
      for (let e = 0; e < 3; e++) {
        const a = I[k + e];
        const b = I[k + ((e + 1) % 3)];
        // Directed edge: in a closed, consistently wound mesh each appears once, its reverse once.
        const key = a * V + b;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
      const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
      const e1 = new Vector3(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]);
      const e2 = new Vector3(P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]);
      const n = e1.cross(e2);
      const m = new Vector3(P[a] + P[b] + P[c], P[a + 1] + P[b + 1] + P[c + 1], P[a + 2] + P[b + 2] + P[c + 2]);
      expect(n.dot(m)).toBeGreaterThan(0);
    }
    for (const [key, count] of edges) {
      expect(count).toBe(1);
      const a = Math.floor(key / V);
      const b = key % V;
      expect(edges.get(b * V + a)).toBe(1);
    }
  });

  it("vertex heights equal terrainHeight", () => {
    const v = new Vector3();
    let maxErr = 0;
    for (let id = 0; id < data.heights.length; id += 7) {
      v.set(data.dirs[id * 3], data.dirs[id * 3 + 1], data.dirs[id * 3 + 2]);
      maxErr = Math.max(maxErr, Math.abs(terrainHeight(v) - data.heights[id]));
      // The float32 positions sit on the same surface.
      const p = new Vector3(data.positions[id * 3], data.positions[id * 3 + 1], data.positions[id * 3 + 2]);
      expect(Math.abs(p.length() - R - data.heights[id])).toBeLessThan(1e-3);
    }
    expect(maxErr).toBeLessThan(1e-6);
  });

  it("terrainHeight between vertices is the mesh triangle surface", () => {
    const rnd = mulberry32(31);
    const I = data.indices;
    const p = new Vector3();
    const dir = new Vector3();
    let maxErr = 0;
    for (let s = 0; s < 4000; s++) {
      const t = Math.floor(rnd() * (I.length / 3));
      let b0 = rnd(), b1 = rnd();
      if (b0 + b1 > 1) { b0 = 1 - b0; b1 = 1 - b1; }
      const b2 = 1 - b0 - b1;
      p.set(0, 0, 0);
      [b0, b1, b2].forEach((w, k) => {
        const id = I[t * 3 + k];
        const r = R + data.heights[id];
        p.x += w * data.dirs[id * 3] * r;
        p.y += w * data.dirs[id * 3 + 1] * r;
        p.z += w * data.dirs[id * 3 + 2] * r;
      });
      dir.copy(p).normalize();
      maxErr = Math.max(maxErr, Math.abs(terrainHeight(dir) - (p.length() - R)));
    }
    expect(maxErr).toBeLessThan(1e-4);
  });

  it("the mesh follows the smooth field closely (outside ridged biomes)", () => {
    // Interpolation error between the faceted mesh and the smooth noise field, i.e. how much
    // detail the ~4 m triangles drop. Ridged/terraced biomes have creases the mesh can't follow.
    const ridged = BIOMES.map((b) => !!b.terrain.ridged);
    const rnd = mulberry32(32);
    const v = new Vector3();
    const errs: number[] = [];
    for (let s = 0; s < 4000; s++) {
      const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      v.set(r * Math.cos(a), z, r * Math.sin(a));
      const w = biomeWeights(v);
      let rw = 0;
      for (let i = 0; i < BIOME_COUNT; i++) if (ridged[i]) rw += w[i];
      if (rw > 0.05) continue;
      errs.push(Math.abs(terrainHeight(v) - analyticHeightXYZ(v.x, v.y, v.z)));
    }
    errs.sort((p, q) => p - q);
    expect(errs[Math.floor(errs.length * 0.95)]).toBeLessThan(0.3);
  });

  it("flattens injected pads in the built mesh", () => {
    const pads = preparePads([{ lat: -20, lon: 35, radius: 20, height: -1 }]);
    const small = buildPlanetMeshData(pads, 24);
    const c = new Vector3(Math.cos(-20 * Math.PI / 180) * Math.sin(35 * Math.PI / 180), Math.sin(-20 * Math.PI / 180), Math.cos(-20 * Math.PI / 180) * Math.cos(35 * Math.PI / 180));
    let inside = 0;
    for (let id = 0; id < small.heights.length; id++) {
      const d = new Vector3(small.dirs[id * 3], small.dirs[id * 3 + 1], small.dirs[id * 3 + 2]);
      if (d.angleTo(c) * R < 20) {
        inside++;
        expect(small.heights[id]).toBeCloseTo(pads[0].target, 9);
      }
    }
    expect(inside).toBeGreaterThan(3);
  });
});
