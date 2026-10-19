import { describe, expect, it } from "vitest";
import { ParticlePool, type ParticleSpawn } from "./particles";

const spawn = (over: Partial<ParticleSpawn> = {}): ParticleSpawn => ({
  x: 0, y: 150, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 0.5, b: 0.25, life: 1, size0: 0.5, size1: 2, alpha: 0.6, ...over,
});
const U = { rise: 1.6, drag: 1.8 };

describe("particle pool", () => {
  it("emits into free slots and writes the render attributes", () => {
    const pool = new ParticlePool(8);
    const i = pool.emit(spawn({ x: 3 }));
    expect(pool.isAlive(i)).toBe(true);
    expect(pool.aliveCount()).toBe(1);
    expect(pool.offset[i * 3]).toBe(3);
    expect(Array.from(pool.color.slice(i * 3, i * 3 + 3))).toEqual([1, 0.5, 0.25]);
  });

  it("never exceeds capacity: recycles the oldest slot when full", () => {
    const pool = new ParticlePool(4);
    const slots = Array.from({ length: 6 }, (_, k) => pool.emit(spawn({ x: k })));
    expect(slots).toEqual([0, 1, 2, 3, 0, 1]);
    expect(pool.aliveCount()).toBe(4);
    // Slot 0 now holds the 5th particle
    expect(pool.offset[0]).toBe(4);
  });

  it("particles rise along local up, grow and fade, then die and free their slot", () => {
    const pool = new ParticlePool(4);
    const i = pool.emit(spawn({ life: 1 }));
    pool.update(0.1, U);
    const size1 = pool.sizeAlpha[i * 2];
    const a1 = pool.sizeAlpha[i * 2 + 1];
    expect(pool.offset[i * 3 + 1]).toBeGreaterThan(150); // up at (0,150,0) is +Y
    for (let k = 0; k < 5; k++) pool.update(0.1, U);
    expect(pool.sizeAlpha[i * 2]).toBeGreaterThan(size1);
    expect(pool.sizeAlpha[i * 2 + 1]).toBeLessThan(a1);
    for (let k = 0; k < 5; k++) pool.update(0.1, U);
    expect(pool.isAlive(i)).toBe(false);
    expect(pool.sizeAlpha[i * 2]).toBe(0);
    expect(pool.aliveCount()).toBe(0);
  });

  it("rises radially anywhere on the planet", () => {
    const pool = new ParticlePool(2);
    const i = pool.emit(spawn({ x: 150, y: 0, z: 0 }));
    pool.update(0.2, U);
    expect(pool.offset[i * 3]).toBeGreaterThan(150);
    expect(Math.abs(pool.offset[i * 3 + 1])).toBeLessThan(1e-6);
  });

  it("a lower limit (low quality) frees the slots above it and wraps emission within it", () => {
    const pool = new ParticlePool(10);
    for (let k = 0; k < 10; k++) pool.emit(spawn());
    pool.setLimit(3);
    expect(pool.limit).toBe(3);
    expect(pool.aliveCount()).toBe(3);
    const slots = Array.from({ length: 5 }, () => pool.emit(spawn()));
    expect(Math.max(...slots)).toBeLessThan(3);
    pool.setLimit(1000);
    expect(pool.limit).toBe(10);
  });
});
