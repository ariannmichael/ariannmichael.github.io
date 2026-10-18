import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ARM, armTargetRatio, capHeight, ceilingCap, smoothArmRatio, smoothCeilingCap } from "./armMath";

const DT = 1 / 60;

describe("spring arm target", () => {
  it("uses the full arm when nothing is in the way", () => {
    expect(armTargetRatio(null, 10)).toBe(1);
    expect(armTargetRatio(12, 10)).toBe(1);
  });

  it("stops short of the obstacle by the margin", () => {
    expect(armTargetRatio(5, 10, 0.1, 1)).toBeCloseTo(0.49);
  });

  it("never shrinks below the minimum length (or the arm itself, if shorter)", () => {
    expect(armTargetRatio(0, 10, 0.1, 1.4)).toBeCloseTo(0.14);
    expect(armTargetRatio(0, 1, 0.1, 1.4)).toBe(1);
  });
});

describe("asymmetric arm smoothing", () => {
  it("pulls in fast and eases out slowly", () => {
    const len = 10;
    // One frame in: most of the way there, and never more than `slack` beyond the target
    const inOne = smoothArmRatio(1, 0.3, len, DT);
    expect(inOne).toBeLessThanOrEqual(0.3 + ARM.slack / len + 1e-9);
    // One frame out: barely moves
    const outOne = smoothArmRatio(0.3, 1, len, DT);
    expect(outOne - 0.3).toBeLessThan(0.05);
    expect(outOne).toBeGreaterThan(0.3);
  });

  it("converges both ways and is frame-rate independent", () => {
    let a = 0.2;
    for (let i = 0; i < 600; i++) a = smoothArmRatio(a, 1, 10, DT);
    expect(a).toBeCloseTo(1, 3);
    let at60 = 0.2;
    for (let i = 0; i < 60; i++) at60 = smoothArmRatio(at60, 1, 10, 1 / 60);
    let at30 = 0.2;
    for (let i = 0; i < 30; i++) at30 = smoothArmRatio(at30, 1, 10, 1 / 30);
    expect(at30).toBeCloseTo(at60, 6);
  });

  it("time to get within 5% of a pulled-in target is about a frame or two, out takes over a second", () => {
    let a = 1;
    let frames = 0;
    while (a > 0.3 + 0.05 && frames < 1000) {
      a = smoothArmRatio(a, 0.3, 10, DT);
      frames++;
    }
    expect(frames).toBeLessThanOrEqual(2);
    let b = 0.3;
    let t = 0;
    while (b < 0.95 && t < 10) {
      b = smoothArmRatio(b, 1, 10, DT);
      t += DT;
    }
    expect(t).toBeGreaterThan(0.8);
  });
});

describe("ceiling", () => {
  it("caps the height under a roof, never below the pivot", () => {
    expect(ceilingCap(null)).toBe(Infinity);
    expect(ceilingCap(2, 2.4, 0.5)).toBeCloseTo(3.9);
    expect(ceilingCap(0.1, 2.4, 0.5)).toBe(2.4);
  });

  it("drops at once and rises slowly, releasing to no cap in the open", () => {
    expect(smoothCeilingCap(Infinity, 3.9, DT)).toBe(3.9);
    const up = smoothCeilingCap(3.9, 6, DT);
    expect(up).toBeGreaterThan(3.9);
    expect(up).toBeLessThan(4);
    let c = 3.9;
    for (let i = 0; i < 60 * 8; i++) c = smoothCeilingCap(c, Infinity, DT);
    expect(c).toBe(Infinity);
  });

  it("capHeight lowers a point along local up only when it's above the cap", () => {
    const origin = new Vector3(0, 0, 150);
    const up = new Vector3(0, 0, 1);
    const p = new Vector3(0, -9, 154);
    expect(capHeight(p, origin, up, 3.5)).toBeCloseTo(0.5);
    expect(p.z).toBeCloseTo(153.5);
    expect(p.y).toBe(-9);
    const q = new Vector3(0, -9, 152);
    expect(capHeight(q, origin, up, 3.5)).toBe(0);
    expect(capHeight(q, origin, up, Infinity)).toBe(0);
  });
});
