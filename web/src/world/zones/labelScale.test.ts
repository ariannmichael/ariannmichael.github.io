import { describe, expect, it } from "vitest";
import { labelScale } from "./Zones";

describe("labelScale", () => {
  it("hides labels right next to the camera and very far away", () => {
    expect(labelScale(3)).toBe(0);
    expect(labelScale(200)).toBe(0);
  });

  it("keeps full size at a distance (perspective already shrinks it)", () => {
    expect(labelScale(28)).toBe(1);
    expect(labelScale(90)).toBe(1);
  });

  it("shrinks as the camera gets close, never below the minimum", () => {
    expect(labelScale(14)).toBeCloseTo(0.5);
    expect(labelScale(7.5)).toBeGreaterThanOrEqual(0.3);
  });
});
