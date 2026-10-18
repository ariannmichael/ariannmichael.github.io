import { describe, expect, it } from "vitest";
import {
  BAYER4,
  PSX_DEFAULTS,
  bayerIndex,
  bayerThreshold,
  internalResolution,
  isCompactViewport,
  quantise,
  snapGrid,
  targetHeight,
} from "./config";

describe("Bayer 4x4", () => {
  it("bit-interleave formula reproduces the classic matrix", () => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(bayerIndex(x, y)).toBe(BAYER4[y * 4 + x]);
  });
  it("tiles every 4 px, including negatives", () => {
    expect(bayerIndex(5, 6)).toBe(bayerIndex(1, 2));
    expect(bayerIndex(-1, -3)).toBe(bayerIndex(3, 1));
  });
  it("is a permutation of 0..15 with a zero-mean threshold", () => {
    expect([...BAYER4].sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
    let sum = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) sum += bayerThreshold(x, y);
    expect(sum).toBeCloseTo(0, 10);
    expect(bayerThreshold(0, 0)).toBeCloseTo(-15 / 32, 10);
  });
});

describe("quantise", () => {
  it("rounds to 31 levels at 5 bits", () => {
    expect(quantise(0, 5)).toBe(0);
    expect(quantise(1, 5)).toBe(1);
    expect(quantise(0.5, 5)).toBeCloseTo(16 / 31, 10); // 15.5 rounds up
    expect(quantise(10 / 31 + 0.001, 5)).toBeCloseTo(10 / 31, 10);
  });
  it("dither shifts by up to half a step and clamps", () => {
    const v = 10.4 / 31;
    expect(quantise(v, 5, 0.45)).toBeCloseTo(11 / 31, 10);
    expect(quantise(v, 5, -0.45)).toBeCloseTo(10 / 31, 10);
    expect(quantise(1, 5, 0.49)).toBe(1);
    expect(quantise(0, 5, -0.49)).toBe(0);
  });
  it("dithered average over a 4x4 tile approximates the input", () => {
    for (const v of [0.13, 0.42, 0.77]) {
      let sum = 0;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) sum += quantise(v, 5, bayerThreshold(x, y));
      expect(Math.abs(sum / 16 - v)).toBeLessThan(1 / 31 / 8);
    }
  });
});

describe("internal resolution", () => {
  it("fixed height, width from aspect", () => {
    expect(internalResolution(1920, 1080, 360)).toEqual({ width: 640, height: 360 });
    expect(internalResolution(390, 844, 270)).toEqual({ width: 125, height: 270 });
    expect(internalResolution(2560, 1080, 360)).toEqual({ width: 853, height: 360 });
  });
  it("never upsamples past the viewport and never hits zero", () => {
    expect(internalResolution(300, 200, 360)).toEqual({ width: 300, height: 200 });
    expect(internalResolution(0, 0, 360)).toEqual({ width: 1, height: 1 });
  });
  it("picks the mobile height on small viewports or low quality", () => {
    expect(isCompactViewport(390, 844)).toBe(true);
    expect(targetHeight(390, 844, "high")).toBe(PSX_DEFAULTS.heightMobile);
    expect(targetHeight(1920, 1080, "high")).toBe(PSX_DEFAULTS.heightDesktop);
    expect(targetHeight(1920, 1080, "low")).toBe(PSX_DEFAULTS.heightMobile);
  });
  it("snap grid keeps the aspect and caps at the render height", () => {
    expect(snapGrid(640, 360, 240)).toEqual({ x: 427, y: 240 });
    expect(snapGrid(125, 200, 240)).toEqual({ x: 125, y: 200 });
  });
});
