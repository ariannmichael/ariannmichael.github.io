import { describe, expect, it } from "vitest";
import { Color, Vector3 } from "three";
import { BIOMES } from "./biomes";
import { BIOME_COUNT, biomeWeights } from "./biomeField";
import { surfaceFrame } from "./frame";
import { mulberry32 } from "./noise";
import {
  analyticHeightXYZ,
  applyPads,
  meshHeightXYZ,
  naturalHeightXYZ,
  preparePads,
  terrainHeight,
  vergeMaskXYZ,
} from "./terrain";
import { getRoads, roadBedXYZ } from "./roads";
import { groundColorAt } from "./terrainColor";

const DEG = Math.PI / 180;
const R = 150;

function randomDir(rnd: () => number, out = new Vector3()) {
  const z = rnd() * 2 - 1;
  const t = rnd() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(t), z, r * Math.sin(t));
}

/** Rotate `dir` by `metres` along the surface toward unit tangent `t`. */
function step(dir: Vector3, t: Vector3, metres: number, out = new Vector3()) {
  const a = metres / R;
  return out.copy(dir).multiplyScalar(Math.cos(a)).addScaledVector(t, Math.sin(a)).normalize();
}

const RIDGED = BIOMES.map((b) => !!b.terrain.ridged);
function ridgedWeight(dir: Vector3) {
  const w = biomeWeights(dir);
  let s = 0;
  for (let i = 0; i < BIOME_COUNT; i++) if (RIDGED[i]) s += w[i];
  return s;
}

describe("terrainHeight", () => {
  it("is deterministic and bounded (−25..+40 m)", () => {
    const rnd = mulberry32(21);
    const v = new Vector3();
    for (let i = 0; i < 5000; i++) {
      randomDir(rnd, v);
      const h = terrainHeight(v);
      expect(h).toBeGreaterThan(-25);
      expect(h).toBeLessThan(40);
      expect(terrainHeight(v.clone())).toBe(h);
    }
  });

  it("accepts non-normalised directions", () => {
    const v = new Vector3(0.3, 0.5, -0.2);
    expect(terrainHeight(v.clone().multiplyScalar(170))).toBeCloseTo(terrainHeight(v.normalize()), 9);
  });

  it("is continuous: a 2 cm move changes height by only centimetres", () => {
    const rnd = mulberry32(22);
    const v = new Vector3();
    const u = new Vector3();
    for (let i = 0; i < 3000; i++) {
      randomDir(rnd, v);
      const f = surfaceFrame(v);
      step(v, rnd() < 0.5 ? f.east : f.north, 0.02, u);
      // Steepest faces are ~60°: tan(60°)·2 cm ≈ 3.5 cm.
      expect(Math.abs(terrainHeight(u) - terrainHeight(v))).toBeLessThan(0.06);
    }
  });

  it("keeps non-ridged terrain drivable: 95th percentile slope < 35°", () => {
    const rnd = mulberry32(23);
    const v = new Vector3();
    const a = new Vector3();
    const b = new Vector3();
    const slopes: number[] = [];
    const ridgedSlopes: number[] = [];
    for (let i = 0; i < 6000; i++) {
      randomDir(rnd, v);
      const f = surfaceFrame(v);
      const h = terrainHeight(v);
      const gx = (terrainHeight(step(v, f.east, 0.5, a)) - h) / 0.5;
      const gy = (terrainHeight(step(v, f.north, 0.5, b)) - h) / 0.5;
      const slope = Math.atan(Math.hypot(gx, gy)) / DEG;
      if (ridgedWeight(v) < 0.05) slopes.push(slope);
      else ridgedSlopes.push(slope);
    }
    slopes.sort((p, q) => p - q);
    ridgedSlopes.sort((p, q) => p - q);
    const p95 = slopes[Math.floor(slopes.length * 0.95)];
    const ridgedMedian = ridgedSlopes[Math.floor(ridgedSlopes.length * 0.5)];
    expect(p95).toBeLessThan(35);
    // Ridged biomes are meant to be steep, but most of the ground must still be climbable.
    expect(ridgedMedian).toBeLessThan(30);
  });

  it("road verges exist but cover only a small part of the planet", () => {
    const rnd = mulberry32(24);
    const v = new Vector3();
    let on = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      randomDir(rnd, v);
      const m = vergeMaskXYZ(v.x, v.y, v.z);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
      if (m > 0.5) on++;
    }
    expect(on / N).toBeGreaterThan(0.002);
    expect(on / N).toBeLessThan(0.1);
  });

  it("road beds flatten the ground under a road, and the verge fades out inside pads", () => {
    const road = getRoads()[0];
    const k = Math.floor(road.count / 2) * 3;
    const [x, y, z] = [road.p[k], road.p[k + 1], road.p[k + 2]];
    // Exactly the bed (blended with any other road close by)
    const bed = roadBedXYZ(x, y, z, getRoads(), { weight: 0, target: 0 });
    expect(bed.weight).toBe(1);
    expect(analyticHeightXYZ(x, y, z, [])).toBeCloseTo(bed.target, 5);
    expect(analyticHeightXYZ(x, y, z, [], [])).toBe(naturalHeightXYZ(x, y, z));
    const lat = Math.asin(y) / DEG;
    const lon = Math.atan2(x, z) / DEG;
    const pads = preparePads([{ lat, lon, radius: 10, blend: 8 }]);
    expect(vergeMaskXYZ(x, y, z, [])).toBe(1);
    expect(vergeMaskXYZ(x, y, z, pads)).toBe(0);
  });

  it("groundColorAt returns a palette colour without allocating when given `out`", () => {
    const out = new Color();
    const c = groundColorAt(new Vector3(0, 0.17, 0.98).normalize(), out);
    expect(c).toBe(out);
    expect(c.r + c.g + c.b).toBeGreaterThan(0);
  });
});

describe("flat pads", () => {
  const lat = 10;
  const lon = 0;
  const dir = new Vector3(Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.cos(lon * DEG));
  const pads = preparePads([{ lat, lon, radius: 14, height: 1.5 }]);
  const target = naturalHeightXYZ(dir.x, dir.y, dir.z) + 1.5;
  const tangent = surfaceFrame(dir).east;

  it("resolves the target height from the natural terrain at the centre", () => {
    expect(pads[0].target).toBeCloseTo(target, 9);
    expect(pads[0].blend).toBe(8);
  });

  it("flattens inside the radius, blends over `blend`, and leaves the rest alone", () => {
    const p = new Vector3();
    for (let m = 0; m <= 40; m += 0.5) {
      step(dir, tangent, m, p);
      const natural = naturalHeightXYZ(p.x, p.y, p.z);
      const h = analyticHeightXYZ(p.x, p.y, p.z, pads);
      if (m <= 14) expect(h).toBeCloseTo(target, 9);
      else if (m >= 22.01) expect(h).toBeCloseTo(natural, 9);
      else {
        expect(h).toBeGreaterThanOrEqual(Math.min(target, natural) - 1e-9);
        expect(h).toBeLessThanOrEqual(Math.max(target, natural) + 1e-9);
      }
    }
  });

  it("the mesh surface is flat inside the pad (away from its rim)", () => {
    const p = new Vector3();
    const rnd = mulberry32(25);
    for (let i = 0; i < 300; i++) {
      const f = surfaceFrame(dir);
      const ang = rnd() * Math.PI * 2;
      const t = f.east.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.north, Math.sin(ang));
      step(dir, t, rnd() * 9, p); // ≥ one triangle inside the 14 m radius
      // Triangles are chords of the sphere, so a flat pad sags by at most a couple of centimetres.
      expect(Math.abs(meshHeightXYZ(p.x, p.y, p.z, pads) - target)).toBeLessThan(0.05);
    }
  });

  it("is a pure function of the pad list (no pads = natural height)", () => {
    expect(applyPads(dir.x, dir.y, dir.z, 3.25, [])).toBe(3.25);
    expect(analyticHeightXYZ(dir.x, dir.y, dir.z, [], [])).toBe(naturalHeightXYZ(dir.x, dir.y, dir.z));
  });
});
