import { describe, expect, it } from "vitest";
import { BODY, createBodyMotion, kickSquash, resetBodyMotion, stepBodyMotion } from "./bodyMotion";

const settle = (lat: number, lon: number, seconds = 3) => {
  const s = createBodyMotion();
  for (let t = 0; t < seconds; t += 1 / 60) stepBodyMotion(s, lat, lon, 1 / 60);
  return s;
};

describe("body motion", () => {
  it("turning left (accel towards +X) rolls the roof right (positive roll), capped", () => {
    const s = settle(10, 0);
    expect(s.roll).toBeCloseTo(10 * BODY.rollPerAccel, 2);
    expect(settle(-100, 0).roll).toBeCloseTo(-BODY.maxRoll, 2);
  });

  it("accelerating lifts the nose (negative pitch), braking dips it", () => {
    expect(settle(0, 10).pitch).toBeLessThan(0);
    expect(settle(0, -20).pitch).toBeGreaterThan(0);
    expect(Math.abs(settle(0, -500).pitch)).toBeLessThanOrEqual(BODY.maxPitch + 1e-3);
  });

  it("a landing squashes, overshoots into a stretch and settles back to rest", () => {
    const s = createBodyMotion();
    kickSquash(s, 1);
    let max = 0;
    let min = 0;
    for (let t = 0; t < 2; t += 1 / 60) {
      stepBodyMotion(s, 0, 0, 1 / 60);
      max = Math.max(max, s.squash);
      min = Math.min(min, s.squash);
    }
    expect(max).toBeGreaterThan(0.08);
    expect(max).toBeLessThanOrEqual(BODY.maxSquash);
    expect(min).toBeLessThan(0);
    expect(Math.abs(s.squash)).toBeLessThan(0.005);
  });

  it("is stable at a long frame (substeps) and reset returns to rest", () => {
    const s = createBodyMotion();
    kickSquash(s, 1);
    stepBodyMotion(s, 30, -30, 0.1);
    expect(Number.isFinite(s.squash) && Math.abs(s.squash) <= BODY.maxSquash).toBe(true);
    resetBodyMotion(s);
    expect(Object.values(s).every((v) => v === 0)).toBe(true);
    expect(stepBodyMotion(s, 0, 0, 0)).toBe(s);
  });
});
