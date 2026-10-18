import { describe, expect, it } from "vitest";
import { SHAKE, addTrauma, decayTrauma, noise1, rumbleAmount, shakeAmount, shakeOffsets, shakeState } from "./shake";

describe("trauma", () => {
  it("accumulates and clamps to 0..1; ignores non-positive amounts", () => {
    shakeState.trauma = 0;
    addTrauma(0.4);
    addTrauma(0.4);
    expect(shakeState.trauma).toBeCloseTo(0.8);
    addTrauma(5);
    expect(shakeState.trauma).toBe(1);
    addTrauma(-1);
    addTrauma(Number.NaN);
    expect(shakeState.trauma).toBe(1);
    shakeState.trauma = 0;
  });

  it("decays linearly to zero and stays there", () => {
    expect(decayTrauma(1, 0.25)).toBeCloseTo(1 - SHAKE.decay * 0.25);
    expect(decayTrauma(0.1, 1)).toBe(0);
  });

  it("shake is trauma squared (small knocks stay small) plus rumble", () => {
    expect(shakeAmount(0.5)).toBeCloseTo(0.25);
    expect(shakeAmount(1)).toBe(1);
    expect(shakeAmount(0.2, 0.05)).toBeCloseTo(0.09);
    expect(shakeAmount(1, 1)).toBe(1);
  });

  it("rumble grows with speed and rough ground, zero at rest", () => {
    expect(rumbleAmount(0, 1)).toBe(0);
    expect(rumbleAmount(1, 1)).toBeCloseTo(SHAKE.rumbleMax);
    expect(rumbleAmount(1, 0)).toBeLessThan(rumbleAmount(1, 1));
    expect(rumbleAmount(0.5, 0.5)).toBeLessThan(rumbleAmount(1, 0.5));
  });
});

describe("noise-based offsets", () => {
  it("noise is bounded, zero at integers and continuous", () => {
    for (let x = -20; x < 20; x += 0.037) {
      const n = noise1(x);
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
      expect(Math.abs(noise1(x + 0.001) - n)).toBeLessThan(0.02);
    }
    expect(noise1(3)).toBeCloseTo(0);
  });

  it("is deterministic and not constant", () => {
    expect(noise1(1.37)).toBe(noise1(1.37));
    const values = new Set([0.3, 1.3, 2.3, 3.3, 4.3].map((x) => noise1(x).toFixed(4)));
    expect(values.size).toBeGreaterThan(3);
  });

  it("offsets scale with the amount and the quality scale; zero amount = no shake", () => {
    const o = { x: 0, y: 0, roll: 0, yaw: 0, pitch: 0 };
    shakeOffsets(0, 1.234, o);
    expect([o.x, o.y, o.roll, o.yaw, o.pitch].every((v) => v === 0)).toBe(true);
    let maxX = 0;
    for (let t = 0; t < 5; t += 0.01) maxX = Math.max(maxX, Math.abs(shakeOffsets(1, t, o).x));
    expect(maxX).toBeGreaterThan(SHAKE.maxOffset * 0.3);
    expect(maxX).toBeLessThanOrEqual(SHAKE.maxOffset);
    const full = shakeOffsets(1, 2.71, o).x;
    expect(shakeOffsets(1, 2.71, o, 0.5).x).toBeCloseTo(full * 0.5);
  });
});
