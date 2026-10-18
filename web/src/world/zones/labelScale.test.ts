import { describe, expect, it } from "vitest";
import { labelScale } from "./Zones";

describe("labelScale", () => {
  it("hides labels right next to the camera and very far away", () => {
    expect(labelScale(3)).toBe(0);
    expect(labelScale(200)).toBe(0);
  });

  it("keeps full size at mid distance (perspective already shrinks it)", () => {
    expect(labelScale(28)).toBe(1);
    expect(labelScale(60)).toBe(1);
  });

  it("grows again far away so the intro orbit stays readable", () => {
    expect(labelScale(110)).toBeCloseTo(1.4);
    expect(labelScale(160)).toBeCloseTo(1.8);
    expect(labelScale(120)).toBeGreaterThan(labelScale(80));
  });

  it("shrinks as the camera gets close, never below the minimum", () => {
    expect(labelScale(14)).toBeCloseTo(0.5);
    expect(labelScale(7.5)).toBeGreaterThanOrEqual(0.3);
  });
});
