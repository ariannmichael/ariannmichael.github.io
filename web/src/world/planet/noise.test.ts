import { describe, expect, it } from "vitest";
import { createNoise3D, fbm, hash01, mulberry32, ridgedFbm, smoothstep } from "./noise";

describe("noise", () => {
  it("is deterministic per seed and differs between seeds", () => {
    const a = createNoise3D(42);
    const b = createNoise3D(42);
    const c = createNoise3D(43);
    let diff = 0;
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37, y = i * -0.21, z = i * 0.13;
      expect(a(x, y, z)).toBe(b(x, y, z));
      diff += Math.abs(a(x, y, z) - c(x, y, z));
    }
    expect(diff).toBeGreaterThan(1);
  });

  it("stays in range and actually varies", () => {
    const n = createNoise3D(7);
    const rnd = mulberry32(1);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < 20000; i++) {
      const v = n(rnd() * 100 - 50, rnd() * 100 - 50, rnd() * 100 - 50);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(1.2);
  });

  it("is continuous", () => {
    const n = createNoise3D(3);
    for (let i = 0; i < 500; i++) {
      const x = i * 0.731, y = i * 0.117, z = -i * 0.293;
      expect(Math.abs(n(x, y, z) - n(x + 1e-4, y, z))).toBeLessThan(2e-3);
    }
  });

  it("fbm is in [-1, 1] and ridged fbm in [0, 1]", () => {
    const n = createNoise3D(11);
    const rnd = mulberry32(2);
    for (let i = 0; i < 5000; i++) {
      const x = rnd() * 40, y = rnd() * 40, z = rnd() * 40;
      const f = fbm(n, x, y, z, 4, 2, 0.5);
      const r = ridgedFbm(n, x, y, z, 3, 2, 0.4);
      const rc = ridgedFbm(n, x, y, z, 3, 2, 0.4, 0.3);
      expect(f).toBeGreaterThanOrEqual(-1);
      expect(f).toBeLessThanOrEqual(1);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(rc).toBeGreaterThanOrEqual(0);
      expect(rc).toBeLessThanOrEqual(1);
    }
  });

  it("hash01 and smoothstep behave", () => {
    expect(hash01(5)).toBe(hash01(5));
    expect(hash01(5)).not.toBe(hash01(6));
    expect(hash01(123)).toBeGreaterThanOrEqual(0);
    expect(hash01(123)).toBeLessThan(1);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });
});
