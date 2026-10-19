import { describe, expect, it } from "vitest";
import { LABEL_GROW_FROM, LABEL_HIDE_FAR, labelScale } from "./Zones";

describe("labelScale", () => {
  it("hides labels right next to the camera and past the far limit (over the horizon, intro globe)", () => {
    expect(labelScale(3)).toBe(0);
    expect(labelScale(LABEL_HIDE_FAR + 1)).toBe(0);
    expect(labelScale(200)).toBe(0);
  });

  it("keeps full size at mid distance (perspective already shrinks it)", () => {
    expect(labelScale(28)).toBe(1);
    expect(labelScale(LABEL_GROW_FROM)).toBe(1);
  });

  it("grows again far away so stops across town stay readable", () => {
    expect(labelScale((LABEL_GROW_FROM + LABEL_HIDE_FAR) / 2)).toBeCloseTo(1.4);
    expect(labelScale(LABEL_HIDE_FAR)).toBeCloseTo(1.8);
    expect(labelScale(LABEL_HIDE_FAR - 5)).toBeGreaterThan(labelScale(LABEL_GROW_FROM + 5));
  });

  it("shrinks as the camera gets close, never below the minimum", () => {
    expect(labelScale(14)).toBeCloseTo(0.5);
    expect(labelScale(7.5)).toBeGreaterThanOrEqual(0.3);
  });
});
