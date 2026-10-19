import { describe, expect, it } from "vitest";
import { FxPool, SHAPE, blankSpawn, type FxSpawn } from "./fxPool";

const R = 150; // a point on a planet-sized sphere, local up = +Y here
const spawn = (over: Partial<FxSpawn> = {}): FxSpawn => ({ ...blankSpawn(), y: R, life: 1, alpha: 1, ...over });

describe("fx pool", () => {
  it("emits into slots, writes render attributes, recycles the oldest when full", () => {
    const pool = new FxPool(3);
    const slots = [0, 1, 2, 3].map((k) => pool.emit(spawn({ x: k, shape: SHAPE.chip })));
    expect(slots).toEqual([0, 1, 2, 0]);
    expect(pool.offset[0]).toBe(3);
    expect(pool.stretch[3]).toBe(SHAPE.chip);
    expect(pool.aliveCount()).toBe(3);
  });

  it("negative accel falls towards the planet centre (local down), positive rises", () => {
    const pool = new FxPool(2);
    // A point on the +X side of the planet: down is -X there, not world -Y
    const a = pool.emit(spawn({ x: R, y: 0, accel: -18 }));
    const b = pool.emit(spawn({ x: R, y: 0, accel: 2 }));
    for (let i = 0; i < 10; i++) pool.update(0.02);
    expect(pool.offset[a * 3]).toBeLessThan(R);
    expect(pool.offset[b * 3]).toBeGreaterThan(R);
    expect(Math.abs(pool.offset[a * 3 + 1])).toBeLessThan(1e-6);
  });

  it("stretch follows velocity × stretchK plus the fixed vector", () => {
    const pool = new FxPool(2);
    const i = pool.emit(spawn({ vx: 10, stretchK: 0.05, sz: 2 }));
    expect(pool.stretch[i * 4]).toBeCloseTo(0.5);
    expect(pool.stretch[i * 4 + 2]).toBeCloseTo(2);
    pool.update(0.01);
    expect(pool.stretch[i * 4 + 2]).toBeCloseTo(2);
  });

  it("drag slows, alpha fades in then out, and particles die at the end of life", () => {
    const pool = new FxPool(1);
    pool.emit(spawn({ vx: 10, drag: 5, life: 0.5, alpha: 0.8, size0: 1, size1: 3 }));
    pool.update(0.1);
    const vAfter = pool.stretch[0]; // stretchK 0: zero
    expect(vAfter).toBe(0);
    const x1 = pool.offset[0];
    pool.update(0.1);
    expect(pool.offset[0] - x1).toBeLessThan(x1); // second step moved less (drag)
    expect(pool.sizeAlpha[1]).toBeGreaterThan(0);
    expect(pool.sizeAlpha[1]).toBeLessThan(0.8);
    expect(pool.sizeAlpha[0]).toBeGreaterThan(1);
    pool.update(0.4);
    expect(pool.isAlive(0)).toBe(false);
    expect(pool.sizeAlpha[0]).toBe(0);
  });

  it("setLimit frees slots beyond the limit and wraps emission inside it", () => {
    const pool = new FxPool(6);
    for (let k = 0; k < 6; k++) pool.emit(spawn());
    pool.setLimit(2);
    expect(pool.aliveCount()).toBe(2);
    expect(pool.isAlive(4)).toBe(false);
    expect([pool.emit(spawn()), pool.emit(spawn()), pool.emit(spawn())]).toEqual([0, 1, 0]);
  });
});
