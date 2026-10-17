import { describe, expect, it } from "vitest";
import { approach, damp, dampAngle, dampFactor, springStep, wrapAngle } from "./damping";

describe("damping", () => {
  it("is frame-rate independent", () => {
    const run = (fps: number) => {
      let x = 0;
      for (let i = 0; i < fps; i++) x = damp(x, 10, 4, 1 / fps);
      return x;
    };
    expect(run(30)).toBeCloseTo(run(144), 6);
    expect(run(60)).toBeCloseTo(10 * (1 - Math.exp(-4)), 6);
  });

  it("factor stays in [0, 1)", () => {
    expect(dampFactor(5, 0)).toBe(0);
    expect(dampFactor(5, 100)).toBeLessThanOrEqual(1);
  });

  it("damps angles along the shortest arc", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    // From 170 deg to -170 deg should go up through 180, not back through 0
    const a = dampAngle((170 * Math.PI) / 180, (-170 * Math.PI) / 180, 10, 0.016);
    expect(a).toBeGreaterThan((170 * Math.PI) / 180);
  });

  it("approach clamps the step", () => {
    expect(approach(5, 0, 2)).toBe(3);
    expect(approach(1, 0, 2)).toBe(0);
    expect(approach(-1, 0, 2)).toBe(0);
  });

  it("spring settles back to the target", () => {
    let x = 0;
    let v = -2;
    for (let i = 0; i < 600; i++) [x, v] = springStep(x, v, 0, 180, 0.35, 1 / 60);
    expect(Math.abs(x)).toBeLessThan(1e-3);
  });
});
