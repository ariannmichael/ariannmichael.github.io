// Load the layout index first: frame → terrain → layouts is an import cycle, and layouts call
// offsetLatLon at module top level, so frame must finish initialising before any layout runs.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { checkLayout, checkTown, padTarget, unreachable } from "./a/check";
import { homeLayout } from "./home";

describe("home layout (Hometown Meadow)", () => {
  it("passes the biome authoring checks", () => {
    checkLayout(homeLayout, ["about", "contact", "cv", "ufcg", "ufcg-monitor", "proj4me"]);
  });

  it("fits the small-planet town budget, with open lanes south-west and south-east for the roads", () => {
    checkTown(homeLayout, [219, 141]);
  });

  it("the campus hall's planar floor sits level with the town core, the kickers stand above it", () => {
    const [core, hall, ...kickers] = homeLayout.pads.map(padTarget);
    expect(homeLayout.pads[1].planar).toBe(true);
    expect(Math.abs(hall - core)).toBeLessThan(0.25);
    expect(kickers[0] - core).toBeCloseTo(1.3, 1);
    expect(kickers[1] - core).toBeCloseTo(1.5, 1);
  });

  it("every marker can be driven to from the spawn", () => {
    const targets = homeLayout.markers.map((m) => ({ name: m.id, at: m }));
    expect(unreachable(homeLayout, targets)).toEqual([]);
  });
});
