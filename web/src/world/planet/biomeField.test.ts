import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { BIOMES } from "./biomes";
import { BIOME_COUNT, biomeWeights, dominantBiome } from "./biomeField";
import { latLonToDir } from "./frame";
import { mulberry32 } from "./noise";
import { biomeAt } from "./terrain";

const randomDir = (rnd: () => number, out = new Vector3()) => {
  // Uniform on the sphere.
  const z = rnd() * 2 - 1;
  const t = rnd() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(t), z, r * Math.sin(t));
};

describe("biome field", () => {
  it("weights sum to 1 and are in [0, 1]", () => {
    const rnd = mulberry32(9);
    const v = new Vector3();
    for (let i = 0; i < 3000; i++) {
      const w = biomeWeights(randomDir(rnd, v));
      let sum = 0;
      for (let k = 0; k < BIOME_COUNT; k++) {
        expect(w[k]).toBeGreaterThanOrEqual(0);
        expect(w[k]).toBeLessThanOrEqual(1);
        sum += w[k];
      }
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it("reuses the output array (no allocation)", () => {
    const out = new Float32Array(BIOME_COUNT);
    expect(biomeWeights(new Vector3(0, 0, 1), out)).toBe(out);
  });

  it("each biome dominates at its own centre", () => {
    for (const b of BIOMES) {
      const dir = latLonToDir(b.center.lat, b.center.lon);
      expect(biomeAt(dir)).toBe(b.id);
      expect(dominantBiome(dir)).toBe(b.id);
      const w = biomeWeights(dir);
      expect(w[BIOMES.indexOf(b)]).toBeGreaterThan(0.99);
    }
  });

  it("blends smoothly across borders", () => {
    const rnd = mulberry32(4);
    const v = new Vector3();
    const u = new Vector3();
    const a = new Float32Array(BIOME_COUNT);
    const b = new Float32Array(BIOME_COUNT);
    for (let i = 0; i < 2000; i++) {
      randomDir(rnd, v);
      u.copy(v).add(new Vector3(1e-4, -1e-4, 1e-4)).normalize();
      biomeWeights(v, a);
      biomeWeights(u, b);
      for (let k = 0; k < BIOME_COUNT; k++) expect(Math.abs(a[k] - b[k])).toBeLessThan(0.01);
    }
  });

  it("every biome owns a reasonable share of the planet", () => {
    const rnd = mulberry32(5);
    const v = new Vector3();
    const counts: Record<string, number> = {};
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const id = biomeAt(randomDir(rnd, v));
      counts[id] = (counts[id] ?? 0) + 1;
    }
    for (const b of BIOMES) expect(counts[b.id] / N).toBeGreaterThan(0.05);
  });
});
